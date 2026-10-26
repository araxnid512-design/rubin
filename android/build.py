#!/usr/bin/env python3
"""Сборка APK игр репозитория без Android SDK.

Нужны: JDK (javac), Python 3 с пакетом `cryptography`.
dx и android.jar скачиваются с Maven Central в android/.tools/.

    python3 android/build.py            # «Каменный Бег»        -> dist/kamenny-beg.apk
    python3 android/build.py clones     # «Клоны против дроидов» -> dist/clones-vs-droids.apk
"""
import hashlib, os, struct, subprocess, sys, urllib.request, zipfile, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.join(ROOT, 'android')
TOOLS = os.path.join(HERE, '.tools')
BUILD = os.path.join(HERE, '.build')
KEY = os.path.join(HERE, 'debug-key.pem')

# игра: пакет, название, иконки и файлы, которые кладутся в assets/
APPS = {
    'caveman': dict(package='com.rubin.kamenbeg', label='Каменный Бег', out='kamenny-beg.apk',
                    icons='icons', assets=['index.html']),
    'clones': dict(package='com.rubin.clonetactics', label='Клоны против дроидов', out='clones-vs-droids.apk',
                   icons='clones/icons', assets=['clones/index.html', 'clones/game.js', 'clones/three.min.js'], version=(4, '1.3')),
}
APP = APPS[sys.argv[1] if len(sys.argv) > 1 else 'caveman']
OUT = os.path.join(ROOT, 'dist', APP['out'])
PACKAGE, LABEL = APP['package'], APP['label']
ACTIVITY = 'com.rubin.kamenbeg.MainActivity'  # общая WebView-обёртка
VERSION_CODE, VERSION_NAME = APP.get('version', (1, '1.0'))
MIN_SDK, TARGET_SDK = 21, 34

MAVEN = 'https://repo1.maven.org/maven2/'
DEPS = {
    'dx.jar': 'com/jakewharton/android/repackaged/dalvik-dx/9.0.0_r3/dalvik-dx-9.0.0_r3.jar',
    'android.jar': 'com/google/android/android/4.1.1.4/android-4.1.1.4.jar',
}

# ---------------------------------------------------------------- AXML

ANDROID_NS = 'http://schemas.android.com/apk/res/android'
ATTR_IDS = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
    'exported': 0x01010010, 'screenOrientation': 0x0101001e, 'configChanges': 0x0101001f,
    'drawable': 0x01010199, 'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b,
    'versionName': 0x0101021c, 'targetSdkVersion': 0x01010270, 'hardwareAccelerated': 0x010102d3,
}
T_REF, T_STR, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def chunk(ctype, header, body):
    """Чанк ResChunk_header: header — байты заголовка после первых 8 байт."""
    hsize = 8 + len(header)
    return struct.pack('<HHI', ctype, hsize, hsize + len(body)) + header + body


def string_pool(strings):
    data, offsets = b'', []
    for s in strings:
        offsets.append(len(data))
        u = s.encode('utf-16-le')
        data += struct.pack('<H', len(u) // 2) + u + b'\0\0'
    data += b'\0' * (-len(data) % 4)
    start = 28 + 4 * len(strings)
    header = struct.pack('<IIIII', len(strings), 0, 0, start, 0)
    return chunk(0x0001, header, b''.join(struct.pack('<I', o) for o in offsets) + data)


def axml(root):
    """root = (tag, [(attr, type, value)], [children]); атрибуты с ns=android, кроме 'package'."""
    attrs_used = []

    def walk(n):
        for a, _, _ in n[1]:
            if a in ATTR_IDS and a not in attrs_used:
                attrs_used.append(a)
        for c in n[2]:
            walk(c)
    walk(root)
    attrs_used.sort(key=lambda a: ATTR_IDS[a])
    strings = list(attrs_used)  # первые строки соответствуют карте ресурсов

    def sid(s):
        if s not in strings:
            strings.append(s)
        return strings.index(s)
    ns_prefix, ns_uri = sid('android'), sid(ANDROID_NS)

    body = []
    meta = struct.pack('<II', 1, 0xFFFFFFFF)

    def emit(n):
        tag, attrs, children = n
        attrs = sorted(attrs, key=lambda a: ATTR_IDS.get(a[0], 0))
        ab = b''
        for name, t, v in attrs:
            ns = 0xFFFFFFFF if name not in ATTR_IDS else ns_uri
            raw = 0xFFFFFFFF
            if t == T_STR:
                raw = data = sid(v)
            elif t == T_BOOL:
                data = 0xFFFFFFFF if v else 0
            else:
                data = v
            ab += struct.pack('<IIIHBBI', ns, sid(name), raw, 8, 0, t, data)
        ext = struct.pack('<IIHHHHHH', 0xFFFFFFFF, sid(tag), 20, 20, len(attrs), 0, 0, 0)
        body.append(chunk(0x0102, meta, ext + ab))
        for c in children:
            emit(c)
        body.append(chunk(0x0103, meta, struct.pack('<II', 0xFFFFFFFF, sid(tag))))

    emit(root)
    nsb = struct.pack('<II', ns_prefix, ns_uri)
    body = [chunk(0x0100, meta, nsb)] + body + [chunk(0x0101, meta, nsb)]
    resmap = chunk(0x0180, b'', b''.join(struct.pack('<I', ATTR_IDS[a]) for a in attrs_used))
    return chunk(0x0003, b'', string_pool(strings) + resmap + b''.join(body))

# ---------------------------------------------------------------- resources.arsc

# drawable: 0 icon, 1 icon_fg, 2 icon_bg  ->  0x7f01000N
DRAWABLES = ['icon', 'icon_fg', 'icon_bg']
FILES = {  # (запись, конфиг) -> путь в APK
    ('icon', 'default'): 'res/drawable/icon.png',
    ('icon_fg', 'default'): 'res/drawable/icon_fg.png',
    ('icon_bg', 'default'): 'res/drawable/icon_bg.png',
    ('icon', 'v26'): 'res/drawable-anydpi-v26/icon.xml',
}


def config(density=0, sdk=0):
    c = bytearray(64)
    struct.pack_into('<I', c, 0, 64)
    struct.pack_into('<H', c, 14, density)
    struct.pack_into('<H', c, 24, sdk)
    return bytes(c)


def arsc():
    values = list(dict.fromkeys(FILES.values()))
    NO = 0xFFFFFFFF

    def type_chunk(cfg_name, cfg):
        offs, entries = [], b''
        for key in DRAWABLES:
            path = FILES.get((key, cfg_name))
            if path is None:
                offs.append(NO)
                continue
            offs.append(len(entries))
            entries += struct.pack('<HHI', 8, 0, DRAWABLES.index(key))
            entries += struct.pack('<HBBI', 8, 0, T_STR, values.index(path))
        hsize = 8 + 4 + 4 + 4 + len(cfg)
        start = hsize + 4 * len(offs)
        header = struct.pack('<BBHII', 1, 0, 0, len(offs), start) + cfg
        return chunk(0x0201, header, b''.join(struct.pack('<I', o) for o in offs) + entries)

    spec = chunk(0x0202, struct.pack('<BBHI', 1, 0, 0, len(DRAWABLES)),
                 struct.pack('<III', 0x0100 | 0x0400, 0, 0))
    types = string_pool(['drawable'])
    keys = string_pool(DRAWABLES)
    name = PACKAGE.encode('utf-16-le').ljust(256, b'\0')
    hsize = 288
    pkg_header = struct.pack('<I', 0x7f) + name + struct.pack('<IIIII', hsize, 1, hsize + len(types), len(DRAWABLES), 0)
    pkg = chunk(0x0200, pkg_header, types + keys + spec +
                type_chunk('default', config()) + type_chunk('v26', config(0xFFFE, 26)))
    return chunk(0x0002, struct.pack('<I', 1), string_pool(values) + pkg)

# ---------------------------------------------------------------- APK Signature Scheme v2


def lp(b):
    return struct.pack('<I', len(b)) + b


def sign_v2(apk_bytes, key_pem):
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    key = serialization.load_pem_private_key(open(key_pem, 'rb').read(), None)
    cert = x509.load_pem_x509_certificate(open(key_pem, 'rb').read())

    eocd = apk_bytes.rfind(b'PK\x05\x06')
    cd_off, = struct.unpack_from('<I', apk_bytes, eocd + 16)
    sections = [apk_bytes[:cd_off], apk_bytes[cd_off:eocd], apk_bytes[eocd:]]
    chunks = []
    for s in sections:
        for i in range(0, len(s), 1 << 20):
            c = s[i:i + (1 << 20)]
            chunks.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest())
    digest = hashlib.sha256(b'\x5a' + struct.pack('<I', len(chunks)) + b''.join(chunks)).digest()

    ALG = 0x0103  # RSASSA-PKCS1-v1_5 + SHA2-256
    digests = lp(lp(struct.pack('<I', ALG) + lp(digest)))
    certs = lp(lp(cert.public_bytes(serialization.Encoding.DER)))
    signed_data = digests + certs + lp(b'')
    sig = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = lp(signed_data) + lp(lp(struct.pack('<I', ALG) + lp(sig))) + lp(pub)
    value = lp(lp(signer))
    pair = struct.pack('<QI', 4 + len(value), 0x7109871a) + value
    size = len(pair) + 8 + 16
    block = struct.pack('<Q', size) + pair + struct.pack('<Q', size) + b'APK Sig Block 42'

    new_eocd = bytearray(sections[2])
    struct.pack_into('<I', new_eocd, 16, cd_off + len(block))
    return sections[0] + block + sections[1] + bytes(new_eocd)


def sign_v1(entries, key_pem):
    """JAR-подпись (v1) для Android 5–6 и строгих установщиков: MANIFEST.MF, CERT.SF, CERT.RSA."""
    import base64
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.serialization import pkcs7

    key = serialization.load_pem_private_key(open(key_pem, 'rb').read(), None)
    cert = x509.load_pem_x509_certificate(open(key_pem, 'rb').read())
    b64 = lambda b: base64.b64encode(hashlib.sha256(b).digest()).decode()
    head = 'Manifest-Version: 1.0\r\nCreated-By: 1.0 (Android)\r\n\r\n'
    sections = [f'Name: {name}\r\nSHA-256-Digest: {b64(data)}\r\n\r\n' for name, data, _ in entries]
    mf = (head + ''.join(sections)).encode()
    sf = ('Signature-Version: 1.0\r\nCreated-By: 1.0 (Android)\r\n'
          f'SHA-256-Digest-Manifest: {b64(mf)}\r\n'
          f'SHA-256-Digest-Manifest-Main-Attributes: {b64(head.encode())}\r\n'
          'X-Android-APK-Signed: 2\r\n\r\n')
    sf += ''.join(f'Name: {name}\r\nSHA-256-Digest: {b64(sec.encode())}\r\n\r\n' for (name, _, _), sec in zip(entries, sections))
    sf = sf.encode()
    rsa = (pkcs7.PKCS7SignatureBuilder().set_data(sf).add_signer(cert, key, hashes.SHA256())
           .sign(serialization.Encoding.DER, [pkcs7.PKCS7Options.DetachedSignature, pkcs7.PKCS7Options.NoAttributes]))
    return [('META-INF/MANIFEST.MF', mf, True), ('META-INF/CERT.SF', sf, True), ('META-INF/CERT.RSA', rsa, True)]


def ensure_key():
    if os.path.exists(KEY):
        return
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Kamenny Beg debug')])
    now = datetime.datetime(2026, 1, 1)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now)
            .not_valid_after(now + datetime.timedelta(days=365 * 30)).sign(key, hashes.SHA256()))
    with open(KEY, 'wb') as f:
        f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        f.write(cert.public_bytes(serialization.Encoding.PEM))

# ---------------------------------------------------------------- сборка


def run(*cmd):
    print('$', ' '.join(cmd))
    subprocess.run(cmd, check=True)


def build():
    os.makedirs(TOOLS, exist_ok=True)
    for fname, path in DEPS.items():
        dst = os.path.join(TOOLS, fname)
        if not os.path.exists(dst):
            print('скачиваю', path)
            urllib.request.urlretrieve(MAVEN + path, dst)
    os.makedirs(os.path.join(BUILD, 'classes'), exist_ok=True)
    srcs = [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(HERE, 'src')) for f in fs if f.endswith('.java')]
    run('javac', '--release', '8', '-nowarn', '-encoding', 'UTF-8',
        '-cp', os.path.join(TOOLS, 'android.jar'), '-d', os.path.join(BUILD, 'classes'), *srcs)
    dex = os.path.join(BUILD, 'classes.dex')
    run('java', '-cp', os.path.join(TOOLS, 'dx.jar'), 'com.android.dx.command.Main', '--dex',
        '--min-sdk-version=' + str(MIN_SDK), '--output=' + dex, os.path.join(BUILD, 'classes'))

    manifest = axml(('manifest', [
        ('package', T_STR, PACKAGE), ('versionCode', T_DEC, VERSION_CODE), ('versionName', T_STR, VERSION_NAME)], [
        ('uses-sdk', [('minSdkVersion', T_DEC, MIN_SDK), ('targetSdkVersion', T_DEC, TARGET_SDK)], []),
        ('application', [
            ('label', T_STR, LABEL), ('icon', T_REF, 0x7f010000),
            ('theme', T_REF, 0x01030007),  # @android:style/Theme.NoTitleBar.Fullscreen
            ('hardwareAccelerated', T_BOOL, True)], [
            ('activity', [
                ('name', T_STR, ACTIVITY), ('exported', T_BOOL, True),
                ('screenOrientation', T_DEC, 6),  # sensorLandscape
                ('configChanges', T_HEX, 0xFF0)], [
                ('intent-filter', [], [
                    ('action', [('name', T_STR, 'android.intent.action.MAIN')], []),
                    ('category', [('name', T_STR, 'android.intent.category.LAUNCHER')], []),
                ]),
            ]),
        ]),
    ]))
    adaptive = axml(('adaptive-icon', [], [
        ('background', [('drawable', T_REF, 0x7f010002)], []),
        ('foreground', [('drawable', T_REF, 0x7f010001)], []),
    ]))

    icons = os.path.join(ROOT, APP['icons'])
    entries = [  # (путь, данные, сжимать)
        ('AndroidManifest.xml', manifest, True),
        ('classes.dex', open(dex, 'rb').read(), True),
        ('resources.arsc', arsc(), False),
        ('res/drawable/icon.png', open(os.path.join(icons, 'icon-192.png'), 'rb').read(), False),
        ('res/drawable/icon_fg.png', open(os.path.join(icons, 'ic-fg.png'), 'rb').read(), False),
        ('res/drawable/icon_bg.png', open(os.path.join(icons, 'ic-bg.png'), 'rb').read(), False),
        ('res/drawable-anydpi-v26/icon.xml', adaptive, True),
    ] + [('assets/' + os.path.basename(a), open(os.path.join(ROOT, a), 'rb').read(), True) for a in APP['assets']]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + '.unsigned'
    ensure_key()
    entries = sign_v1(entries, KEY) + entries  # META-INF первым, как у jarsigner
    with zipfile.ZipFile(tmp, 'w') as z:
        for name, data, deflate in entries:
            zi = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED if deflate else zipfile.ZIP_STORED
            if not deflate:  # zipalign: данные несжатых файлов выровнены на 4 байта
                pos = z.fp.tell() + 30 + len(name.encode())
                pad = (-(pos + 6)) % 4
                zi.extra = struct.pack('<HHH', 0xD935, 2 + pad, 4) + b'\0' * pad
            z.writestr(zi, data)
    signed = sign_v2(open(tmp, 'rb').read(), KEY)
    os.remove(tmp)
    with open(OUT, 'wb') as f:
        f.write(signed)
    print('готово:', OUT, len(signed) // 1024, 'КБ')


if __name__ == '__main__':
    build()
