const {
    getStorageMode,
    incrementCounterBy
} = require('../../lib/counters-store');

function respondJson(res, statusCode, data){

    res.status(statusCode).json(data);

}

module.exports = async (req, res) => {

    if(req.method !== 'POST'){
        respondJson(res, 405, { error:'Method not allowed' });
        return;
    }

    const id = req.body && req.body.id;
    const amount = req.body && req.body.amount;

    try{
        const counters = await incrementCounterBy(id, amount);

        respondJson(res, 200, {
            ...counters,
            storageMode:getStorageMode()
        });
    } catch(err){
        let statusCode = 500;

        if(err.code === 'MISSING_ID' || err.code === 'INVALID_AMOUNT'){
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