const PLUGIN_FRIENDLY_NAME = 'Roam Reddit';

const LOG_PREFIX = '[roam-reddit]';

// Setting keys.
const SETTING_SUBREDDIT_KEY = 'subreddit';
const SETTING_SORT_KEY = 'sort';
const SETTING_HASHTAG = 'hashtag';
const SETTING_TITLE_ONLY_KEY = 'title-only';
const SETTING_BLOCKED_WORDS_KEY = 'blocked-words';
const SETTING_MINIMUM_VOTES_KEY = 'minimum-votes';

// Setting defaults.
const DEFAULT_SUBREDDIT = 'LifeProTips'; // ,LifeProTips,todayilearned, ...
const DEFAULT_SORT = 'rising'; // ,new,rising,top,random, ...
const DEFAULT_HASHTAG = null; // #roam-reddit
const DEFAULT_TITLE_ONLY = false;
const DEFAULT_BLOCKED_WORDS = []; // ['LPT request']
const DEFAULT_MINIMUM_VOTES = 0; // 1000

// Setting active values.
let UserSettings = {
    subreddit: DEFAULT_SUBREDDIT,
    sort: DEFAULT_SORT,
    hashtag: DEFAULT_HASHTAG,
    titleOnly: DEFAULT_TITLE_ONLY,
    blockedWords: DEFAULT_BLOCKED_WORDS,
    blockedWordsRegExps: generateBlockedWordsRegExps(DEFAULT_BLOCKED_WORDS),
    minimumVotes: DEFAULT_MINIMUM_VOTES,
};

function roamSettingKeyToUserSettingKey(roamKey) {
    // E.g. 'blocked-words' -> 'blockedWords'
    const words = roamKey.split('-');
    const [first] = words.splice(0, 1);
    const rest = words.map(w => w.slice(0, 1).toUpperCase() + w.slice(1));
    const userSettingKey = [first, ...rest].join('');
    logDebug(`roamSettingKeyToUserSettingKey: returning: '${roamKey}' -> '${userSettingKey}'`);
    return userSettingKey;
}

function generateBlockedWordsRegExps(words) {
    return words.map(word => new RegExp(`\b${word}\b`, 'ig'));
}

// Set in the onload function, so we assume it is non-null.
let extensionAPI = {};

function logInfo(str, ...args) {
    console.info(`${LOG_PREFIX}: ${str}`, ...args);
}

function logWarn(str, ...args) {
    console.warn(`${LOG_PREFIX}: ${str}`, ...args);
}

function logDebug(str, ...args) {
    console.debug(`${LOG_PREFIX}: ${str}`, ...args);
}

function logErr(str, ...args) {
    console.error(`${LOG_PREFIX}: ${str}`, ...args);
}

async function tryGetFilteredRedditPosts() {
    const { posts: posts1, error } = await tryGetRedditPosts();
    if (error) {
        logDebug(`tryGetFilteredRedditPosts: detected error, skipping`);
        return { posts: posts1, error }; // pass thr;
    } else {
        const posts2 = filterRedditPosts(posts1);
        logDebug(`tryGetFilteredRedditPosts: filtered from ${posts1.length} to ${posts2.length} posts`);
        return { posts: posts2 };
    }
}

function filterRedditPosts(posts) {
    // Blocked words.
    posts = posts.filter(p => UserSettings.blockedWordsRegExps.every(r => !r.test(p.title)));

    // Minimum vote count.
    posts = posts.filter(p => UserSettings.minimumVotes <= p.ups);

    return posts;
}

// tryGetRedditPosts: returns an object like: { posts: [], error?: {} }.
async function tryGetRedditPosts() {
    let result = {
        posts: [],
        error: undefined,
    };
    try {
        const url = buildRedditUrl();
        logDebug(`tryGetRedditPosts: fetching posts: url=${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
            // Continue in catch block.
        } else {
            const body = await response.json();
            logDebug(`tryGetRedditPosts: success!: status=${response.status}, statusText=${response.statusText}, body.length=${body.length}`);
            result.posts = await extractPostsFromResponse(body);
        }
    } catch (err) {
        logErr(`tryGetRedditPosts: error fetching or parsing: url=${url}, err=${err?.message}`, err);
        result.error = err;
    }
    return result;
}

function buildRedditUrl() {
    const url = `https://www.reddit.com/r/${UserSettings.subreddit}/${UserSettings.sort}/.json?limit=10`;
    logDebug(`buildRedditUrl: returning: url=${url}`);
    return url;
}

async function extractPostsFromResponse(body) {
    let result = [];
    let rawPosts = body;

    if (!rawPosts) {
        logErr(`extractPostsFromResponse: got an empty response, returning`);
        return result;
    }

    if (!rawPosts.length) {
        rawPosts = [rawPosts];
    }

    for (const listing of rawPosts) {
        if (!listing.data?.children?.length) {
            continue;
        }

        for (const item of listing.data.children) {
            if (item.kind !== 't3') {
                continue;
            }

            // item.data is a Post
            const { subreddit, title, selftext, author, url, ups } = item.data;
            result.push({
                subreddit,
                title,
                selftext,
                author,
                url,
                ups,
            });
        }
    }

    logDebug(`extractPostsFromResponse: result.length=${result.length}`, result);

    return result;
}

// tryInsertRoamBlock: returns true on success
async function tryInsertRoamBlock(content) {
    let didInsertBlock = false;
    try {
        const uid = getInsertionUID();
        logDebug(`tryInsertRoamBlock: inserting: parentUid=${uid}, content.length=${content.length}`);
        await roamAlphaAPI.createBlock({
            "location": {
                "parent-uid": uid,
                "order": 0,
            },
            "block": {
                "string": content,
            }
        });
        didInsertBlock = true;
    } catch (err) {
        logErr(`tryInsertRoamBlock: failed to insert block: error=err?.message`, err);
    }
    return didInsertBlock;
}

function getInsertionUID() {
    let uid;
    const block = roamAlphaAPI.ui.getFocusedBlock();
    if (block) {
        uid = block['block-uid'];
    }
    if (!uid) {
        uid = getTodayAsRoamFormattedUID();
    }
    logDebug(`getInsertionUID: uid=${uid}`);
    return uid;
}

function getTodayAsRoamFormattedUID() {
    const now = new Date();
    const str = `${padNum(now.getMonth() + 1)}-${padNum(now.getDate())}-${now.getFullYear()}`; // e.g. 07-31-2022
    logDebug(`getTodayAsRoamFormattedUID: str=${str}`);
    return str;
}

function padNum(num) {
    return String(num).padStart(2, '0');
}

function disambiguatePosts(posts) {
    // TODO
    return posts[0];
}

function formatPost(post) {
    let { subreddit, title, selftext, author, url } = post;
    let result;
    const signature = `by ${author} on [r/${subreddit}](${url})`;
    if (UserSettings.titleOnly) {
        result = `${title}\n\n__- ${signature}__`;
    } else {
        result = `${title}\n\n__${selftext}\n\n- ${signature}__`;
    }
    result = `${result} (${post.ups} upvotes)`;
    if (UserSettings.hashtag) {
        result = `${result} ${UserSettings.hashtag}`;
    }
    logDebug(`formatPost: returning, result=${result}`);
    return result;
}

function formatNotice(text, prefix = 'NOTE') {
    let result;
    if (UserSettings.hashtag) {
        result = `${prefix}: ${text} ${UserSettings.hashtag}`;
    } else {
        result = `${prefix}: ${text}`;
    }
    logDebug(`formatNotice: returning, result=${result}`);
    return result;
}

async function run(caller = 'none') {
    logDebug(`run: starting, caller=${caller}`);
    const { posts, error } = await tryGetFilteredRedditPosts();
    let content;
    if (error) {
        content = formatNotice(error, /*prefix*/ 'ERROR');
    } else if (!posts.length) {
        content = formatNotice(`got nothing back from Reddit, maybe check your settings in Settings -> ${PLUGIN_FRIENDLY_NAME}`);
    } else {
        const post = disambiguatePosts(posts);
        content = formatPost(post);
    }
    const didInsertBlock = await tryInsertRoamBlock(content);
    logDebug(`run: completed, didInsertBlock=${didInsertBlock}`);
}

const panelConfig = {
    tabTitle: PLUGIN_FRIENDLY_NAME,
    settings: [{
        id: SETTING_SUBREDDIT_KEY,
        name: 'Subreddit',
        description: '',
        action: {
            type: 'input',
            placeholder: DEFAULT_SUBREDDIT,
            onChange: wrappedOnChangeHandler(SETTING_SUBREDDIT_KEY),
        },
    }, {
        id: SETTING_SORT_KEY,
        name: 'Sort',
        description: 'Top, Rising, New, Random, etc.',
        action: {
            type: 'input',
            placeholder: DEFAULT_SORT,
            onChange: wrappedOnChangeHandler(SETTING_SORT_KEY),
        },
    }, {
        id: SETTING_HASHTAG,
        name: 'Hash tag',
        description: 'Leave blank if none desired',
        action: {
            type: 'input',
            placeholder: DEFAULT_HASHTAG,
            onChange: wrappedOnChangeHandler(SETTING_HASHTAG),
        }
    }, {
        id: SETTING_TITLE_ONLY_KEY,
        name: 'Title only',
        description: 'If true, excludes the body of the post',
        action: {
            type: 'switch',
            onChange: wrappedOnChangeHandler(SETTING_TITLE_ONLY_KEY),
        },
    }, {
        id: SETTING_BLOCKED_WORDS_KEY,
        name: 'Blocked words',
        description: 'Words or phrases that will be used to filter posts',
        action: {
            type: 'input',
            placeholder: DEFAULT_BLOCKED_WORDS,
            onChange: wrappedOnChangeHandler(SETTING_BLOCKED_WORDS_KEY),
        }
    }, {
        id: SETTING_MINIMUM_VOTES_KEY,
        name: 'Minimum upvotes',
        description: '',
        action: {
            type: 'input',
            placeholder: DEFAULT_MINIMUM_VOTES,
            onChange: wrappedOnChangeHandler(SETTING_MINIMUM_VOTES_KEY),
        },
    }],
};

function wrappedOnChangeHandler(key) {
    return (evt) => {
        debounceUpdateSetting(key, evt.target.value);
    };
}

let timeouts = {};

// debounceUpdateSetting:
//  used because I'm getting stale values from extensionAPI.settings even when I delay by a whole second.
//  so instead I use the value from the event object, but we need to debounce it because the onChange handler
//  is actually fired on every keypress instead of like an input.onchange.
function debounceUpdateSetting(key, val) {
    if (timeouts[key]) {
        clearTimeout(timeouts[key]);
    }
    timeouts[key] = setTimeout(() => doUpdateSetting(key, val), 500);
}

function doUpdateSetting(rawKey, rawVal) {
    try {
        logDebug(`doUpdateSetting: starting: rawKey=${rawKey}, rawVal=${rawVal}`);
        let validKey = false;
        const key = roamSettingKeyToUserSettingKey(rawKey);
        let val;
        if (key in UserSettings) {
            val = cleanSettingValue(rawVal, /*forKey*/ rawKey);
            UserSettings[key] = val;
            validKey = true;
        }
        if (val && rawKey === SETTING_BLOCKED_WORDS_KEY) {
            UserSettings.blockedWordsRegExps = generateBlockedWordsRegExps(val);
        }
        if (timeouts[key]) {
            clearTimeout(timeouts[key]);
            timeouts[key] = undefined;
        }
        logDebug(`doUpdateSetting: finished: key=${key}, val=${val}, validKey=${validKey}`, UserSettings);
    } catch (err) {
        logErr(`doUpdateSetting: caught error: err=${err.message}`, err);
    }
}

function cleanSettingValue(rawVal, forKey) {
    let cleanVal = rawVal;
    let didDefault = false;
    logDebug(`cleanSettingValue: starting: rawVal='${rawVal}', forKey=${forKey}`);
    switch (forKey) {
        case SETTING_SUBREDDIT_KEY:
            ({cleanVal, didDefault} = cleanString(rawVal, DEFAULT_SUBREDDIT));
            if (!cleanVal.length) {
                cleanVal = DEFAULT_SUBREDDIT;
            }
            break;
        case SETTING_HASHTAG:
            ({cleanVal, didDefault} = cleanString(rawVal, DEFAULT_HASHTAG));
            // E.g. 'roam-reddit' or '#roam-reddit' or '##roam-reddit' -> '#roam-reddit'
            //  but '' -> ''
            while (cleanVal.length > 0 && cleanVal.charAt(0) === '#') {
                cleanVal = cleanVal.slice(1);
            }
            if (cleanVal.length > 0) {
                cleanVal = `#${cleanVal}`;
            } else {
                cleanVal = null;
            }
            break;
        case SETTING_SORT_KEY:
            ({cleanVal, didDefault} = cleanString(rawVal, DEFAULT_SORT));
            cleanVal = cleanVal.toLowerCase();
            if (!cleanVal.length) {
                cleanVal = DEFAULT_SORT;
            }
            break;
        case SETTING_BLOCKED_WORDS_KEY:
            ({cleanVal, didDefault}= cleanStringArray(rawVal, DEFAULT_BLOCKED_WORDS));
            break;
        case SETTING_MINIMUM_VOTES_KEY:
            ({cleanVal, didDefault} = cleanNumber(rawVal, DEFAULT_MINIMUM_VOTES));
            break;
        case SETTING_TITLE_ONLY_KEY:
            ({cleanVal, didDefault} = cleanBoolean(rawVal, DEFAULT_TITLE_ONLY));
            break;
        default:
            throw new Error(`unrecognized setting: key=${forKey}, rawVal='${rawVal}'`);
    }
    logDebug(`cleanSettingVal: returning '${rawVal}' -> '${JSON.stringify(cleanVal)}': didDefault=${didDefault}`);
    return cleanVal;
}

function cleanString(val, default_) {
    return defaultIfThrows(() => String(val).trim(), default_);
}

function cleanStringArray(val, default_) {
    return defaultIfThrows(() => {
        let ret = String(val);
        ret = ret.split(',').filter(w => !!w).map(w => cleanString(w).cleanVal);
        return ret;
    }, default_);
}

function cleanNumber(val, default_) {
    return defaultIfThrows(() => {
        const ret = Number(val);
        if (Number.isNaN(ret)) {
            throw new Error(`invalid number value: ${val}`);
        }
        if (ret < 0) {
            throw new Error(`invalid number value: ${val}`);
        }
        return ret;
    }, default_)
}

function cleanBoolean(val, default_) {
    return defaultIfThrows(() => {
        let { cleanVal: valAsStr } = cleanString(val, default_);
        valAsStr = valAsStr.toLowerCase();
        if (valAsStr === 'on') {
            return true;
        }
        if (valAsStr === 'off') {
            return false;
        }
        return Boolean(val);
    }, default_);
}

function defaultIfThrows(func, default_) {
    try {
        const cleanVal = func();
        return {
            cleanVal,
            didDefault: false,
        };
    } catch (err) {
        logDebug(`defaultIfThrows: caught error: err=${err.message}`, err);
        return {
            cleanVal: default_,
            didDefault: true,
        };
    }
}

function initializeSettings(source) {
    const blob = extensionAPI.settings.getAll();
    logDebug(`initializeSettings: starting: keys.length=${Object.keys(blob).length}`, blob);
    for (const [rawKey, rawVal] of Object.entries(blob)) {
        doUpdateSetting(rawKey, rawVal);
    }
    logDebug(`initializeSettings: finished: triggeredBy=${source}`, UserSettings);
}

const RUN_COMMAND_LABEL = `${PLUGIN_FRIENDLY_NAME}: Run now`;

function installCommands() {
    roamAlphaAPI.ui.commandPalette.addCommand({
        label: RUN_COMMAND_LABEL,
        callback: () => { return run('command-palette'); },
    });
    logDebug('initializeCommand: done');
}

function uninstallCommands() {
    roamAlphaAPI.ui.commandPalette.removeCommand({
        label: RUN_COMMAND_LABEL,
    });
    logDebug('deinitializeCommand: done');
}

function onload({ extensionAPI: _extensionAPI }) {
    extensionAPI = _extensionAPI;
    extensionAPI.settings.panel.create(panelConfig);
    window.extensionAPI = extensionAPI; // TEMP
    initializeSettings('onload');
    installCommands();
    logDebug('extension loaded');
}

function onunload() {
    uninstallCommands();
    logDebug('extension unloaded');
}

export default {
    onload: onload,
    onunload: onunload,
};