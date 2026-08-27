import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "../app/node_modules/sharp/dist/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "52notelogo2.png");

const renderSquare = async (size) => {
    const padding = Math.max(1, Math.round(size * 0.06));
    return sharp(source)
        .trim({background: {r: 0, g: 0, b: 0, alpha: 0}})
        .resize(size - padding * 2, size - padding * 2, {fit: "contain", kernel: sharp.kernel.lanczos3})
        .extend({top: padding, bottom: padding, left: padding, right: padding, background: {r: 0, g: 0, b: 0, alpha: 0}})
        .resize(size, size, {fit: "fill"})
        .sharpen(size <= 64 ? {sigma: 0.6} : undefined)
        .png({compressionLevel: 9})
        .toBuffer();
};

const writeSquare = async (relativePath, size) => {
    const output = path.join(root, relativePath);
    await fs.mkdir(path.dirname(output), {recursive: true});
    await fs.writeFile(output, await renderSquare(size));
};

const createIco = async (sizes) => {
    const images = await Promise.all(sizes.map(renderSquare));
    const headerSize = 6 + sizes.length * 16;
    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(sizes.length, 4);
    let offset = headerSize;
    sizes.forEach((size, index) => {
        const entry = 6 + index * 16;
        header.writeUInt8(size === 256 ? 0 : size, entry);
        header.writeUInt8(size === 256 ? 0 : size, entry + 1);
        header.writeUInt8(0, entry + 2);
        header.writeUInt8(0, entry + 3);
        header.writeUInt16LE(1, entry + 4);
        header.writeUInt16LE(32, entry + 6);
        header.writeUInt32LE(images[index].length, entry + 8);
        header.writeUInt32LE(offset, entry + 12);
        offset += images[index].length;
    });
    return Buffer.concat([header, ...images]);
};

const createIcns = async () => {
    const entries = [
        ["icp4", 16],
        ["icp5", 32],
        ["icp6", 64],
        ["ic07", 128],
        ["ic08", 256],
        ["ic09", 512],
        ["ic10", 1024],
    ];
    const chunks = [];
    for (const [type, size] of entries) {
        const image = await renderSquare(size);
        const chunk = Buffer.alloc(8 + image.length);
        chunk.write(type, 0, 4, "ascii");
        chunk.writeUInt32BE(chunk.length, 4);
        image.copy(chunk, 8);
        chunks.push(chunk);
    }
    const header = Buffer.alloc(8);
    header.write("icns", 0, 4, "ascii");
    header.writeUInt32BE(8 + chunks.reduce((total, chunk) => total + chunk.length, 0), 4);
    return Buffer.concat([header, ...chunks]);
};

const squareTargets = [
    ["app/src/assets/icon.png", 512],
    ["app/src/assets/icon256.png", 256],
    ["app/src/assets/icon-mac.png", 512],
    ["app/electron/icon.png", 512],
    ["app/stage/icon.png", 512],
    ["app/stage/icon-large.png", 512],
    ["app/stage/images/icon.png", 160],
    ["app/src/assets/icon/16x16.png", 16],
    ["app/src/assets/icon/32x32.png", 32],
    ["app/src/assets/icon/48x48.png", 48],
    ["app/src/assets/icon/64x64.png", 64],
    ["app/src/assets/icon/128x128.png", 128],
    ["app/src/assets/icon/256x256.png", 256],
    ["app/src/assets/icon/512x512.png", 512],
    ["app/appx/assets/Square150x150Logo.png", 150],
    ["app/appx/assets/Square150x150Logo.targetsize-150_altform-lightunplated.png", 150],
    ["app/appx/assets/Square150x150Logo.targetsize-150_altform-unplated.png", 150],
    ["app/appx/assets/Square44x44Logo.png", 44],
    ["app/appx/assets/StoreLogo.png", 50],
    ["app/appx/assets/StoreLogo.targetsize-256_altform-lightunplated.png", 256],
    ["app/appx/assets/StoreLogo.targetsize-256_altform-unplated.png", 256],
];

for (const size of [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256]) {
    squareTargets.push([`app/appx/assets/Square44x44Logo.targetsize-${size}_altform-lightunplated.png`, size]);
    squareTargets.push([`app/appx/assets/Square44x44Logo.targetsize-${size}_altform-unplated.png`, size]);
}

await Promise.all(squareTargets.map(([target, size]) => writeSquare(target, size)));

const wideLogo = await sharp(await renderSquare(128))
    .extend({top: 11, bottom: 11, left: 91, right: 91, background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png({compressionLevel: 9})
    .toBuffer();
await fs.writeFile(path.join(root, "app/appx/assets/Wide310x150Logo.png"), wideLogo);

const appIcon = await createIco([16, 24, 32, 48, 64, 128, 256]);
await fs.writeFile(path.join(root, "app/src/assets/icon.ico"), appIcon);
await fs.writeFile(path.join(root, "kernel/resource/icon.ico"), appIcon);
const favicon = await createIco([16, 32, 48]);
await fs.writeFile(path.join(root, "app/stage/favicon.ico"), favicon);
await fs.writeFile(path.join(root, "app/src/assets/icon.icns"), await createIcns());

console.log(`Generated ${squareTargets.length + 5} icon assets from 52notelogo2.png.`);
