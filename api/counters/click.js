const {
    getStorageMode,
    incrementButtonClick
} = require('../../lib/counters-store');

function respondJson(res, statusCode, data){

    res.status(statusCode).json(data);

}

module.exports = async (req, res) => {

    if(req.method !== 'POST'){
        respondJson(res, 405, { error:'Method not allowed' });
        return;
    }

    try{
        const counters = await incrementButtonClick(req.body && req.body.id);

        respondJson(res, 200, {
            ...counters,
            storageMode:getStorageMode()
        });
    } catch(err){
        let statusCode = 500;

        if(err.code === 'MISSING_ID'){
            statusCode = 400;
        }

        if(err.code === 'KV_NOT_CONFIGURED'){
            statusCode = 503;
        }

        respondJson(res, statusCode, {
            error:err.message
        });
    }

};