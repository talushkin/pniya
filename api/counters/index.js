const {
    getStorageMode,
    readCounters
} = require('../../lib/counters-store');

function respondJson(res, statusCode, data){

    res.status(statusCode).json(data);

}

module.exports = async (req, res) => {

    if(req.method !== 'GET'){
        respondJson(res, 405, { error:'Method not allowed' });
        return;
    }

    try{
        const counters = await readCounters();
        respondJson(res, 200, {
            ...counters,
            storageMode:getStorageMode()
        });
    } catch(err){
        const statusCode = err.code === 'KV_NOT_CONFIGURED' ? 503 : 500;

        respondJson(res, statusCode, {
            error:err.message
        });
    }

};