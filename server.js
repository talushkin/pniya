const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const COUNTERS_FILE = path.join(ROOT_DIR, 'COUNTERS.json');

const DEFAULT_COUNTERS = {
    pageOpens:0,
    buttonClicks:{}
};

function ensureCountersFile(){

    if(fs.existsSync(COUNTERS_FILE)){
        return;
    }

    fs.writeFileSync(
        COUNTERS_FILE,
        JSON.stringify(DEFAULT_COUNTERS, null, 2),
        'utf8'
    );

}

function readCounters(){

    ensureCountersFile();

    try{

        const raw = fs.readFileSync(COUNTERS_FILE, 'utf8');
        const parsed = JSON.parse(raw);

        return {
            pageOpens:Number(parsed.pageOpens || 0),
            buttonClicks:parsed.buttonClicks || {}
        };

    } catch(err){

        fs.writeFileSync(
            COUNTERS_FILE,
            JSON.stringify(DEFAULT_COUNTERS, null, 2),
            'utf8'
        );

        return {
            ...DEFAULT_COUNTERS
        };

    }

}

function writeCounters(counters){

    fs.writeFileSync(
        COUNTERS_FILE,
        JSON.stringify(counters, null, 2),
        'utf8'
    );

}

function respondJson(res, statusCode, data){

    res.writeHead(statusCode, {
        'Content-Type':'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(data));

}

function parseBody(req){

    return new Promise(resolve => {

        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {

            if(!body){
                resolve({});
                return;
            }

            try{
                resolve(JSON.parse(body));
            } catch(err){
                resolve({});
            }

        });

    });

}

function getContentType(filePath){

    const ext = path.extname(filePath).toLowerCase();

    if(ext === '.html') return 'text/html; charset=utf-8';
    if(ext === '.css') return 'text/css; charset=utf-8';
    if(ext === '.js') return 'application/javascript; charset=utf-8';
    if(ext === '.json') return 'application/json; charset=utf-8';
    if(ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if(ext === '.png') return 'image/png';
    if(ext === '.svg') return 'image/svg+xml';
    if(ext === '.ico') return 'image/x-icon';

    return 'text/plain; charset=utf-8';

}

function safePathFromUrl(urlPath){

    const normalized = path.normalize(urlPath).replace(/^\/+/, '');

    if(normalized.includes('..')){
        return null;
    }

    if(!normalized || normalized === '/'){
        return path.join(ROOT_DIR, 'index.html');
    }

    return path.join(ROOT_DIR, normalized);

}

const server = http.createServer(async (req, res) => {

    if(!req.url){
        respondJson(res, 400, { error:'Bad request' });
        return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if(requestUrl.pathname === '/api/counters' && req.method === 'GET'){

        const counters = readCounters();
        respondJson(res, 200, counters);
        return;

    }

    if(requestUrl.pathname === '/api/counters/open' && req.method === 'POST'){

        const counters = readCounters();
        counters.pageOpens += 1;
        writeCounters(counters);
        respondJson(res, 200, counters);
        return;

    }

    if(requestUrl.pathname === '/api/counters/click' && req.method === 'POST'){

        const body = await parseBody(req);
        const id = typeof body.id === 'string' ? body.id.trim() : '';

        if(!id){
            respondJson(res, 400, { error:'Missing id' });
            return;
        }

        const counters = readCounters();

        counters.buttonClicks[id] =
            Number(counters.buttonClicks[id] || 0) + 1;

        writeCounters(counters);
        respondJson(res, 200, counters);
        return;

    }

    if(req.method !== 'GET'){
        respondJson(res, 405, { error:'Method not allowed' });
        return;
    }

    let filePath = safePathFromUrl(requestUrl.pathname);

    if(!filePath){
        respondJson(res, 403, { error:'Forbidden' });
        return;
    }

    if(filePath.endsWith(path.sep)){
        filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {

        if(err){
            respondJson(res, 404, { error:'Not found' });
            return;
        }

        res.writeHead(200, {
            'Content-Type':getContentType(filePath)
        });
        res.end(data);

    });

});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
