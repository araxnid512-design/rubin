// Сборка three.js для игры: обычный скрипт (WebView открывает file://, модули там не грузятся) → window.THREE
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const THREE = Object.assign({}, T, { GLTFLoader, SkeletonUtils, BufferGeometryUtils, MeshoptDecoder });
window.THREE = THREE;
