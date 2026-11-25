const session = process.env.SESSION || '';
const mycode = process.env.CODE || "254";
const botname = process.env.BOTNAME || '𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮';
const herokuAppName = process.env.HEROKU_APP_NAME || '';

function getHerokuApiKey() {
    return process.env.HEROKU_API_KEY || '';
}

function getAllOwners() {
    const raw = process.env.OWNER_NUMBER || process.env.OWNERS || process.env.SUDO || '';
    return raw
        .split(',')
        .map(num => num.replace(/\D/g, ''))
        .filter(Boolean);
}

export { session, mycode, botname, herokuAppName, getHerokuApiKey, getAllOwners };
