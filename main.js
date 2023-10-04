const axios = require('axios'); //debug : proxy: { protocol: 'http', host: '127.0.0.1', port: 8888 }
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

//url a récup, risque de modif les mardi : https://proxyconnection.touch.dofus.com/config.json -> assetsUrl
const assetUrl = `https://dofustouch.cdn.ankama.com/assets/2.46.4_byk230XYjY4gzEEGAaWeL4uuA'_OX'qW`;

const CONSTANTS = {
    CELL_WIDTH: 86,
    CELL_HEIGHT: 43,
    CELL_HALF_WIDTH: 43,
    CELL_HALF_HEIGHT: 21.5,
    NB_CELLS: 560
};

async function getImage(path, id) {
    return new Promise(async (resolve, reject) => {
        let img;
        if (!fs.existsSync(`./cache/${path}`)) {
            fs.mkdirSync(`./cache/${path}`, { recursive: true });
        }
        if (fs.existsSync(`./cache/${path}/${id}`)) {
            img = await loadImage(`./cache/${path}/${id}`);
            resolve(img);
        } else {
            const writer = fs.createWriteStream(`./cache/${path}/${id}`);
            const streamResponse = await axios.get(`${assetUrl}/${path}/${id}`, {responseType: 'stream'})
    
            streamResponse.data.pipe(writer);
    
            let error = null;
            writer.on('error', err => {
                error = err;
                console.log(error)
                writer.close();
                process.exit(1);
            });
            writer.on('finish', async () => {
                img = await loadImage(`./cache/${path}/${id}`);
                resolve(img);
            });
        }
    })
}

/*
function getCellPos(cellId, nbCellPerRow) {
    const pos = { x: 0, y: 0 };
    let id = cellId;

    while (id > 0) {
        const nbCellOnThisRow = pos.y % 2 === 0 ? nbCellPerRow : nbCellPerRow - 1;
        if (id >= nbCellOnThisRow) {
            pos.y++;
            id -= nbCellOnThisRow;
        } else {
            pos.x += id;
            id = 0;
        }
    }
    return pos;
}

function rotateImage(image, rotation) {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.translate(image.width / 2, image.height / 2);
    ctx.rotate(rotation);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    return canvas;
}*/

async function generateMap(mapid) {
    axios.get(`${assetUrl}/maps/${mapid}.json`).then(async (response) => {
        const mapData = response.data;
        if (!mapData.cells.length > 0) {
            console.error('No data found');
            return;
        };
        const startTime = new Date();
        const imageDim = {
            width: 1267,//(mapData.width - 1) * CONSTANTS.CELL_WIDTH,
            height: 866,//(mapData.height - 1) * CONSTANTS.CELL_HEIGHT,
        };

        const mapCanvas = createCanvas(imageDim.width, imageDim.height);

        const context = mapCanvas.getContext('2d');

        //get background (OK)
        const image = await getImage("backgrounds", `${mapid}.jpg`);
        context.drawImage(image, 0, 0, imageDim.width, imageDim.height);

        //midgroundLayer (semi ok)
        let mapElements = mapData.midgroundLayer;
        let cellIds = Object.keys(mapElements)
        for (let index = 0; index < cellIds.length; index++) {
            const cellId = cellIds[index];
            const cellElements = mapElements[cellId];
            for (var e = 0; e < cellElements.length; e++) {
                var element = cellElements[e];
                element.position = parseInt(cellId, 10);
                element.layer = 0;
                var hue = element.hue;
                hue[0] = 1 + hue[0] / 127;
                hue[1] = 1 + hue[1] / 127;
                hue[2] = 1 + hue[2] / 127;
                hue[3] = 1;
                console.log(element)
                const image = await getImage("gfx/world/png", `${element.g}.png`);
                context.drawImage(image, element.x, element.y, element.cw, element.ch);
            }
        }

        //atlasLayout?????? c quoi?

        //foreground (vérif si la)

        const buffer = mapCanvas.toBuffer('image/png');
        if (!fs.existsSync(`./output`)) fs.mkdirSync(`./output`);
        fs.writeFileSync(`./output/${mapid}.png`, buffer);
        console.log(`Map ${mapid} rendered in ${new Date() - startTime}ms ! (output/${mapid}.png)`);
    }).catch((error) => {
        console.error((error.response) ? error.response.data : error);
    });
}

if (process.argv[2]) {
    if (Number.isInteger(parseInt(process.argv[2]))) {
        generateMap(process.argv[2]);
    } else {
        console.error('Mapid must be numeric');
    }
} else {
    console.error('Please provide a mapid as argument');
}
