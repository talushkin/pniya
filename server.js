const http = require('http');
const path = require('path');

const {
    incrementButtonClick,
    incrementPageOpens,
    readCounters
} = require('./lib/counters-store');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const fs = require('fs');

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

        try{
            const counters = await readCounters();
            respondJson(res, 200, counters);
            return;
        } catch(err){
            respondJson(res, 500, { error:err.message });
            return;
        }

    }

    if(requestUrl.pathname === '/api/counters/open' && req.method === 'POST'){

        try{
            const counters = await incrementPageOpens();
            respondJson(res, 200, counters);
            return;
        } catch(err){
            respondJson(res, 500, { error:err.message });
            return;
        }

    }

    if(requestUrl.pathname === '/api/counters/click' && req.method === 'POST'){

        const body = await parseBody(req);
        const id = typeof body.id === 'string' ? body.id.trim() : '';

        if(!id){
            respondJson(res, 400, { error:'Missing id' });
            return;
        }

        try{
            const counters = await incrementButtonClick(id);
            respondJson(res, 200, counters);
            return;
        } catch(err){
            respondJson(res, 500, { error:err.message });
            return;
        }

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
