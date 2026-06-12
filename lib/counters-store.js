const fs = require('fs');
const path = require('path');

const { createClient } = require('redis');

const ROOT_DIR = path.join(__dirname, '..');
const COUNTERS_FILE = path.join(ROOT_DIR, 'COUNTERS.json');

const DEFAULT_COUNTERS = {
    pageOpens:0,
    buttonClicks:{}
};

let redis = null;

function getRedisUrl(){

    const redisUrl = process.env.REDIS_URL || '';

    if(
        !redisUrl
        || redisUrl === 'database_provisioning_in_progress'
    ){
        return '';
    }

    return redisUrl;

}

async function getRedisClient(){

    if(!hasKvConfig()){
        return null;
    }

    if(!redis){
        redis = createClient({
            url:getRedisUrl()
        });

        redis.on('error', err => {
            console.error('Redis client error', err);
        });

        await redis.connect();
    }

    return redis;

}

function hasKvConfig(){

    return Boolean(getRedisUrl());

}

function isVercelRuntime(){

    return Boolean(process.env.VERCEL);

}

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

function normalizeButtonClicks(buttonClicks){

    if(!buttonClicks || typeof buttonClicks !== 'object'){
        return {};
    }

    return Object.fromEntries(
        Object.entries(buttonClicks).map(([key, value]) => {
            return [key, Number(value || 0)];
        })
    );

}

function readCountersFromFile(){

    ensureCountersFile();

    try{

        const raw = fs.readFileSync(COUNTERS_FILE, 'utf8');
        const parsed = JSON.parse(raw);

        return {
            pageOpens:Number(parsed.pageOpens || 0),
            buttonClicks:normalizeButtonClicks(parsed.buttonClicks)
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

function writeCountersToFile(counters){

    fs.writeFileSync(
        COUNTERS_FILE,
        JSON.stringify(counters, null, 2),
        'utf8'
    );

}

function ensureSharedStorage(){

    if(hasKvConfig()){
        return;
    }

    if(isVercelRuntime()){
        const error = new Error('Shared Redis storage is not configured for this project.');
        error.code = 'KV_NOT_CONFIGURED';
        throw error;
    }

}

async function readCounters(){

    if(hasKvConfig()){
        const redis = await getRedisClient();
        const [pageOpens, buttonClicks] = await Promise.all([
            redis.get('counters:pageOpens'),
            redis.hGetAll('counters:buttonClicks')
        ]);

        return {
            pageOpens:Number(pageOpens || 0),
            buttonClicks:normalizeButtonClicks(buttonClicks)
        };
    }

    ensureSharedStorage();
    return readCountersFromFile();

}

async function incrementPageOpens(){

    if(hasKvConfig()){
        const redis = await getRedisClient();
        const pageOpens = await redis.incr('counters:pageOpens');
        const buttonClicks = await redis.hGetAll('counters:buttonClicks');

        return {
            pageOpens:Number(pageOpens || 0),
            buttonClicks:normalizeButtonClicks(buttonClicks)
        };
    }

    ensureSharedStorage();

    const counters = readCountersFromFile();
    counters.pageOpens += 1;
    writeCountersToFile(counters);
    return counters;

}

function normalizeIncrementAmount(amount){

    const parsed = Number(amount);

    if(!Number.isFinite(parsed) || parsed <= 0){
        const error = new Error('Invalid amount');
        error.code = 'INVALID_AMOUNT';
        throw error;
    }

    return Math.floor(parsed);

}

async function incrementCounterBy(counterId, amount){

    const normalizedCounterId =
        typeof counterId === 'string' ? counterId.trim() : '';

    if(!normalizedCounterId){
        const error = new Error('Missing id');
        error.code = 'MISSING_ID';
        throw error;
    }

    const normalizedAmount = normalizeIncrementAmount(amount);

    if(hasKvConfig()){
        const redis = await getRedisClient();

        await redis.hIncrBy(
            'counters:buttonClicks',
            normalizedCounterId,
            normalizedAmount
        );

        return readCounters();
    }

    ensureSharedStorage();

    const counters = readCountersFromFile();

    counters.buttonClicks[normalizedCounterId] =
        Number(counters.buttonClicks[normalizedCounterId] || 0)
        + normalizedAmount;

    writeCountersToFile(counters);
    return counters;

}

async function incrementButtonClick(counterId){

    return incrementCounterBy(counterId, 1);

}

function getStorageMode(){

    if(hasKvConfig()){
        return 'redis';
    }

    return 'file';

}

module.exports = {
    DEFAULT_COUNTERS,
    getStorageMode,
    incrementCounterBy,
    incrementButtonClick,
    incrementPageOpens,
    readCounters
};