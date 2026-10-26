import java.io.RandomAccessFile;
import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

/**
 * Проверка подписи APK кодом самого Android (android-all из Robolectric):
 * ApkSignatureSchemeV2Verifier сверяет подпись, а хэши содержимого считает
 * ApkSigningBlockUtils — так же, как установщик на телефоне.
 * В обычной JVM нет pread из libcore, поэтому данные APK подаются из памяти.
 */
public class ApkCheck {
  public static void main(String[] a) throws Exception {
    var signer = android.util.apk.ApkSignatureSchemeV2Verifier.verify(a[0], false);
    var si = android.util.apk.ApkSignatureSchemeV2Verifier.findSignature(new RandomAccessFile(a[0], "r"));
    byte[] f = Files.readAllBytes(Path.of(a[0]));
    Class<?> bbds = Class.forName("android.util.apk.ByteBufferDataSource"), ds = Class.forName("android.util.apk.DataSource");
    Constructor<?> mk = bbds.getDeclaredConstructor(ByteBuffer.class);
    mk.setAccessible(true);
    ByteBuffer eocd = si.eocd.duplicate().order(ByteOrder.LITTLE_ENDIAN);
    eocd.putInt(eocd.position() + 16, (int) si.apkSigningBlockOffset); // как ZipUtils.setZipEocdCentralDirectoryOffset
    Object[] srcs = (Object[]) Array.newInstance(ds, 3);
    srcs[0] = mk.newInstance(ByteBuffer.wrap(f, 0, (int) si.apkSigningBlockOffset).slice());
    srcs[1] = mk.newInstance(ByteBuffer.wrap(f, (int) si.centralDirOffset, (int) (si.eocdOffset - si.centralDirOffset)).slice());
    srcs[2] = mk.newInstance(eocd);
    Method m = android.util.apk.ApkSigningBlockUtils.class.getDeclaredMethod("computeContentDigestsPer1MbChunk", int[].class, srcs.getClass());
    m.setAccessible(true);
    int[] algs = signer.contentDigests.keySet().stream().filter(k -> k == 1 || k == 2).mapToInt(Integer::intValue).toArray();
    if (algs.length == 0) throw new SecurityException("нет хэшей содержимого");
    byte[][] got = (byte[][]) m.invoke(null, algs, srcs);
    for (int i = 0; i < algs.length; i++)
      if (!Arrays.equals(got[i], signer.contentDigests.get(algs[i]))) throw new SecurityException("хэш содержимого не совпал");
    System.out.println("Android v2: подпись и хэши верны, " + signer.certs[0][0].getSubjectX500Principal());
  }
}
