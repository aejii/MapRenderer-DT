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

function getBoxParam(element) {
    var cx = element.cx || 0;
	var cy = element.cy || 0;

	var x = element.x;
	var y = element.y;

	var sx = element.sx || 1;
	var sy = element.sy || 1;

	var w = element.cw;
	var h = element.ch;

	var x0 = -cx * sx;
	var y0 = -cy * sy;

	var x1 = (w - cx) * sx;
	var y1 = -cy * sy;

	var x2 = -cx * sx;
	var y2 = (h - cy) * sy;

	var x3 = (w - cx) * sx;
	var y3 = (h - cy) * sy;

	var rotation = element.rotation || 0;
	if (rotation !== 0) {
		var cos = Math.cos(rotation);
		var sin = Math.sin(rotation);

		var x0tmp = x0;
		var x1tmp = x1;
		var x2tmp = x2;
		var x3tmp = x3;

		x0 = x0 * cos - y0 * sin;
		y0 = x0tmp * sin + y0 * cos;

		x1 = x1 * cos - y1 * sin;
		y1 = x1tmp * sin + y1 * cos;

		x2 = x2 * cos - y2 * sin;
		y2 = x2tmp * sin + y2 * cos;

		x3 = x3 * cos - y3 * sin;
		y3 = x3tmp * sin + y3 * cos;
	}

	x0 = x0 + x;
	y0 = y0 + y;

	x1 = x1 + x;
	y1 = y1 + y;

	x2 = x2 + x;
	y2 = y2 + y;

	x3 = x3 + x;
	y3 = y3 + y;

	return [x0, y0, x1, y1, x2, y2, x3, y3]
}

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
                var layoutElement = mapData.atlasLayout.graphicsPositions[cellElements[e].g];
                //if (element.g != 14574) continue;
                
                let x = element.x + CONSTANTS.CELL_HALF_WIDTH;
                let y = element.y + CONSTANTS.CELL_HALF_HEIGHT;
                let sx = element.sx;

                element.position = parseInt(cellId, 10);
                element.layer = 0;
                var hue = element.hue;
                hue[0] = 1 + hue[0] / 127;
                hue[1] = 1 + hue[1] / 127;
                hue[2] = 1 + hue[2] / 127;
                hue[3] = 1;
                //hue non appliqué
                //console.log(element)
                const image = await getImage("gfx/world/png", `${element.g}.png`);

                context.save();
                if (sx == -1) {
                  // it means horizontal flip
                  context.scale(-1, 1);
                  x = -x;
                }
                context.drawImage(image, x, y, element.cw, element.ch);
                context.restore();

                //context.drawImage(image, element.x, element.y, element.cw, element.ch);//sans rota
            }
        }

        //atlasLayout?????? tilesset de la map (utile/20?)
        /*let mapElements = mapData.atlasLayout.graphicsPositions;
        let cellIds = Object.keys(mapElements)
        for (let index = 0; index < cellIds.length; index++) {
            
            const cellId = cellIds[index];
            const element = mapElements[cellId];
            console.log(element)
            const image = await getImage("gfx/world/png", `${cellId}.png`);
            context.drawImage(image, element.sx, element.sy, element.sw, element.sh);
        }*/

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
