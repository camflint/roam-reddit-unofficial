const PLUGIN_FRIENDLY_NAME = 'Reddit Unofficial';

const LOG_PREFIX = '[reddit-unofficial]';

// Setting keys.
const SETTING_SUBREDDITS_KEY = 'subreddits';
const SETTING_SORT_KEY = 'sort';
const SETTING_NUMBER_OF_POSTS_KEY = 'number-of-posts';
const SETTING_HASHTAG_KEY = 'hashtag';
const SETTING_GROUP_KEY = 'group';
const SETTING_TITLE_ONLY_KEY = 'title-only';
const SETTING_BLOCKED_WORDS_KEY = 'blocked-words';
const SETTING_MINIMUM_VOTES_KEY = 'minimum-votes';
const ALL_SETTING_KEYS = [
    SETTING_SUBREDDITS_KEY,
    SETTING_SORT_KEY,
    SETTING_NUMBER_OF_POSTS_KEY,
    SETTING_HASHTAG_KEY,
    SETTING_GROUP_KEY,
    SETTING_TITLE_ONLY_KEY,
    SETTING_BLOCKED_WORDS_KEY,
    SETTING_MINIMUM_VOTES_KEY,
];

// Setting defaults.
const DEFAULT_SUBREDDITS = ['LifeProTips', 'todayilearned'];
const DEFAULT_SORT = 'Rising'; // ,new,rising,top,random, ...
const DEFAULT_NUMBER_OF_POSTS = 1;
const DEFAULT_HASHTAG = '#reddit-unofficial';
const DEFAULT_GROUP = true;
const DEFAULT_TITLE_ONLY = false;
const DEFAULT_BLOCKED_WORDS = []; // ['LPT request']
const DEFAULT_MINIMUM_VOTES = 0; // 1000

// Setting active values.
let UserSettings = {
    subreddits: DEFAULT_SUBREDDITS,
    sort: DEFAULT_SORT,
    numberOfPosts: DEFAULT_NUMBER_OF_POSTS,
    hashtag: DEFAULT_HASHTAG,
    group: DEFAULT_GROUP,
    titleOnly: DEFAULT_TITLE_ONLY,
    blockedWords: DEFAULT_BLOCKED_WORDS,
    blockedWordsRegExps: generateBlockedWordsRegExps(DEFAULT_BLOCKED_WORDS),
    minimumVotes: DEFAULT_MINIMUM_VOTES,
};

// Helper rules for datalog queries.
const RULE_ANCESTORS = `[
    [ (ancestor ?child ?parent)
         [?parent :block/children ?child] ]
    [ (ancestor ?child ?a)
         [?parent :block/children ?child ]
         (ancestor ?parent ?a) ] ]`;

function roamSettingKeyToUserSettingKey(roamKey) {
    // E.g. 'blocked-words' -> 'blockedWords'
    const words = roamKey.split('-');
    const [first] = words.splice(0, 1);
    const rest = words.map(w => w.slice(0, 1).toUpperCase() + w.slice(1));
    const userSettingKey = [first, ...rest].join('');
    logDebug(`roamSettingKeyToUserSettingKey: returning: ${roamKey} -> ${userSettingKey}`);
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

async function tryGetFilteredRedditPosts(subreddit) {
    const { posts: posts1, error } = await tryGetRedditPosts(subreddit);
    if (error) {
        logDebug(`tryGetFilteredRedditPosts: detected error, skipping`);
        return { posts: posts1, error }; // pass thr;
    } else {
        const posts2 = filterRedditPosts(posts1);
        logDebug(`tryGetFilteredRedditPosts: filtered from ${posts1.length} to ${posts2.length} posts`, posts2);
        return { posts: posts2 };
    }
}

function filterRedditPosts(posts) {
    // Apply: blocked words.
    posts = posts.filter(p => UserSettings.blockedWordsRegExps.every(r => !r.test(p.title)));

    // Apply: minimum vote count.
    posts = posts.filter(p => UserSettings.minimumVotes <= p.ups);

    // Randomize the remaining posts.
    posts = shuffle(posts);

    // Apply: allowed number of posts.
    posts = posts.splice(0, UserSettings.numberOfPosts);

    return posts;
}

function shuffle(ary) {
    let randomIndex;
    let currentIndex = ary.length;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {
        // Pick a remaining element.
        randomIndex = getRandomInt(currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [ary[currentIndex], ary[randomIndex]] = [
            ary[randomIndex], ary[currentIndex]];
    }

    return ary;
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

// tryGetRedditPosts: returns an object like: { posts: [], error?: {} }.
async function tryGetRedditPosts(subreddit) {
    let result = {
        posts: [],
        error: undefined,
    };
    const url = buildRedditUrl(subreddit);
    try {
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

function buildRedditUrl(subreddit) {
    const url = `https://www.reddit.com/r/${subreddit}/${UserSettings.sort}/.json?limit=25`;
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
            const { subreddit, title, selftext, author, permalink, ups } = item.data;
            const url = `https://www.reddit.com${permalink}`;
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
        const insertionBlock = await getInsertionBlock();
        let rootBlock;
        if (!UserSettings.group) {
            rootBlock = insertionBlock;
        } else {
            logDebug(`tryInsertRoamBlock: grouping enabled; first get or create root block`);
            rootBlock = await getOrCreateRootBlock(insertionBlock);
        }
        logDebug(`tryInsertRoamBlock: inserting: insertionBlock=${JSON.stringify(insertionBlock)}, rootBlock=${JSON.stringify(rootBlock)}, group=${UserSettings.group}, content.length=${content.length}`);
        await roamAlphaAPI.createBlock({
            'location': {
                'parent-uid': rootBlock.uid,
                'order': 'last',
            },
            'block': {
                'string': content,
            }
        });
        didInsertBlock = true;
    } catch (err) {
        logErr(`tryInsertRoamBlock: failed to insert block: error=${err?.message}`, err);
    }
    return didInsertBlock;
}

async function getInsertionBlock() {
    let uid = await roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
    logDebug(`getInsertionBlock: first attempt from open page or block: uid=${uid}`);
    if (!uid) {
        uid = roamAlphaAPI.util.dateToPageUid(new Date());
        logDebug(`getInsertionBlock: second attempt from daily page: uid=${uid}`);
    }
    if (!uid) {
        throw new Error(`unable to get insertion block!`);
    }
    let entityId;
    ([[entityId, uid]] = roamAlphaAPI.q(`[:find ?e ?uid :in $ ?uid :where [?e :block/uid ?uid]]`, uid));
    if (!entityId) {
        throw new Error(`unable to expand insertion uid to entityId: uid=${uid}`);
    }
    logDebug(`getInsertionBlock: succeeded: entityId=${entityId}, uid=${uid}`);
    return {
        entityId,
        uid,
    };
}

async function getOrCreateRootBlock(insertionBlock) {
    const rootString = formatRootBlockString();
    logDebug(`getOrCreateRootBlock: searching for ${rootString} starting from insertionBlock=${JSON.stringify(insertionBlock)}`);

    let tries = 1;
    let rootBlockRaw;
    while (!rootBlockRaw && tries <= 3) {
        let didCreate = false;
        rootBlockRaw = roamAlphaAPI.q(`[
            :find ?e ?uid
            :in $ ?i ?text %
            :where
            [?e :block/string ?text]
            [?e :block/uid ?uid]
            (ancestor ?e ?i)
        ]`, insertionBlock.entityId, rootString, RULE_ANCESTORS)[0];
        if (rootBlockRaw) {
            logDebug(`getOrCreateRootBlock: found existing root: rootBlockRaw=${JSON.stringify(rootBlockRaw)}`);
        } else {
            await roamAlphaAPI.createBlock({
                'location': {
                    'parent-uid': insertionBlock.uid,
                    'order': 'last',
                },
                'block': {
                    'string': rootString,
                }
            });
            logDebug(`getOrCreateRootBlock: created root`);
            didCreate = true;
        }
        logDebug(`getOrCreateRootBlock: try=${tries}, rootBlockRaw=${JSON.stringify(rootBlockRaw)}, didCreate=${didCreate}`);
        tries += 1;
    }

    if (!rootBlockRaw) {
        throw new Error(`exhausted tries while getting/creating root block`);
    }

    return {
        entityId: rootBlockRaw[0],
        uid: rootBlockRaw[1],
    };
}

function formatRootBlockString() {
    // We gotta have some text as the root block content, else it looks bad.
    return `${UserSettings.hashtag ?? PLUGIN_FRIENDLY_NAME}`;
}

function padNum(num) {
    return String(num).padStart(2, '0');
}

function formatPost(post) {
    let { subreddit, title, selftext, author, url } = post;
    let result;
    const signature = `by ${author} on [r/${subreddit}](${url})`;
    if (UserSettings.titleOnly || !selftext.length) {
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

async function runForSingleSubreddit(subreddit, caller = 'none') {
    logDebug(`runForSingleSubreddit: starting: subreddit=${subreddit}, caller=${caller}`);
    const { posts, error } = await tryGetFilteredRedditPosts(subreddit);
    let contents = [];
    if (error) {
        contents = [formatNotice(error, /*prefix*/ 'ERROR')];
    } else if (!posts.length) {
        contents = [formatNotice(`got nothing back from Reddit, maybe check your settings in Settings -> ${PLUGIN_FRIENDLY_NAME}`)];
    } else {
        contents = posts.map(formatPost);
    }
    let insertedBlocks = 0;
    for (const content of contents) {
        if (await tryInsertRoamBlock(content)) {
            insertedBlocks += 1;
        }
    }
    logDebug(`runForSingleSubreddit: completed, insertedBlocks=${insertedBlocks}`);
    return insertedBlocks > 0;
}

async function runForAllSubreddits(caller = 'none') {
    logDebug(`runForAllSubreddits: starting: caller=${caller}`);
    const promises = UserSettings.subreddits.map(
        subreddit => runForSingleSubreddit(subreddit, caller),
    );
    const insertions = await Promise.all(promises);
    logDebug(`runForAllSubreddits: completed: succeeded=${insertions.filter(i => !!i).length}`);
}

const panelConfig = {
    tabTitle: PLUGIN_FRIENDLY_NAME,
    settings: [{
        id: SETTING_SUBREDDITS_KEY,
        name: 'Subreddits',
        description: 'Comma-separated list of subreddits',
        action: {
            type: 'input',
            placeholder: DEFAULT_SUBREDDITS[0],
            onChange: wrappedOnChangeHandler(SETTING_SUBREDDITS_KEY),
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
        id: SETTING_NUMBER_OF_POSTS_KEY,
        name: 'Number of posts',
        action: {
            type: 'input',
            placeholder: DEFAULT_NUMBER_OF_POSTS,
            onChange: wrappedOnChangeHandler(SETTING_NUMBER_OF_POSTS_KEY),
        },
    }, {
        id: SETTING_HASHTAG_KEY,
        name: 'Hash tag',
        description: 'Leave blank if none desired',
        action: {
            type: 'input',
            placeholder: DEFAULT_HASHTAG,
            onChange: wrappedOnChangeHandler(SETTING_HASHTAG_KEY),
        }
    }, {
        id: SETTING_GROUP_KEY,
        name: 'Group',
        description: 'Group multiple posts under a single parent block',
        action: {
            type: 'switch',
            onChange: wrappedOnChangeHandler(SETTING_GROUP_KEY),
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
        description: 'Comma-separated list of words or phrases that will be used to filter posts',
        action: {
            type: 'input',
            placeholder: DEFAULT_BLOCKED_WORDS.join(','),
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
        let val;
        switch (key) {
            case SETTING_GROUP_KEY:
            case SETTING_TITLE_ONLY_KEY:
                val = evt.target.checked;
                break;
            default:
                val = evt.target.value;
        }
        debounceUpdateSetting(key, val);
    };
}

let timeouts = {};
let suppressUpdate = false;

// debounceUpdateSetting:
//  used because I'm getting stale values from extensionAPI.settings even when I delay by a whole second.
//  so instead I use the value from the event object, but we need to debounce it because the onChange handler
//  is actually fired on every keypress instead of like an input.onchange.
function debounceUpdateSetting(key, val) {
    if (suppressUpdate) { 
        return;
    }
    if (timeouts[key]) {
        clearTimeout(timeouts[key]);
    }
    timeouts[key] = setTimeout(() => doUpdateSetting(key, val), 500);
}

function doUpdateSetting(rawKey, rawVal) {
    try {
        logDebug(`doUpdateSetting: starting: rawKey=${rawKey}, rawVal=${rawVal}`);
        const appKey = roamSettingKeyToUserSettingKey(rawKey);
        let appVal, didDefault, validKey;
        if (appKey in UserSettings) {
            ({ appVal, didDefault } = rawSettingValueToAppValue(rawVal, /*forKey*/ rawKey));
            UserSettings[appKey] = appVal;
            validKey = true;
        }
        if (appVal && rawKey === SETTING_BLOCKED_WORDS_KEY) {
            UserSettings.blockedWordsRegExps = generateBlockedWordsRegExps(appVal);
        }
        if (appVal && rawKey === SETTING_SUBREDDITS_KEY) {
            reinstallCommands();
        }
        if (didDefault) {
            suppressUpdate = true;
            const newVal = renderAppValueToSettingValue(appVal);
            extensionAPI.settings.set(rawKey, newVal);
            logDebug(`doUpdateSetting: overwrote to default: rawKey=${rawKey}, rawVal=${rawVal}, appVal=${appVal}, newVal=${newVal}`);
            suppressUpdate = false;
        }
        if (timeouts[appKey]) {
            clearTimeout(timeouts[appKey]);
            timeouts[appKey] = undefined;
        }
        logDebug(`doUpdateSetting: finished: rawKey=${rawKey}, rawVal=${rawVal}, appKey=${appKey}, appVal=${appVal}, didDefault=${didDefault}, validKey=${validKey}`, UserSettings);
    } catch (err) {
        logErr(`doUpdateSetting: caught error: err=${err.message}`, err);
    }
}

function rawSettingValueToAppValue(rawVal, forKey) {
    let appVal = rawVal;
    let didDefault = false;
    logDebug(`rawSettingValueToAppValue: starting: rawVal=${rawVal}, forKey=${forKey}`);
    switch (forKey) {
        case SETTING_SUBREDDITS_KEY:
            ({ appVal, didDefault } = parseStringArray(rawVal, DEFAULT_SUBREDDITS));
            if (!appVal.length) {
                appVal = DEFAULT_SUBREDDITS;
                didDefault = true;
            }
            break;
        case SETTING_SORT_KEY:
            ({ appVal, didDefault } = parseString(rawVal, DEFAULT_SORT));
            if (!appVal.length) {
                appVal = DEFAULT_SORT;
                didDefault = true;
            }
            appVal = appVal.toLowerCase();
            break;
        case SETTING_NUMBER_OF_POSTS_KEY:
            ({ appVal, didDefault } = parseNumber(rawVal, DEFAULT_NUMBER_OF_POSTS));
            break;
        case SETTING_HASHTAG_KEY:
            ({ appVal, didDefault } = parseString(rawVal, DEFAULT_HASHTAG));
            // E.g. 'reddit-unofficial' or '#reddit-unofficial' or '##reddit-unofficial' -> '#reddit-unofficial'
            //  but '' -> ''
            while (appVal.length > 0 && appVal.charAt(0) === '#') {
                appVal = appVal.slice(1);
            }
            if (appVal.length > 0) {
                appVal = `#${appVal}`;
            } else {
                appVal = null;
            }
            break;
        case SETTING_GROUP_KEY:
            ({ appVal, didDefault } = parseBoolean(rawVal, DEFAULT_GROUP));
            break;
        case SETTING_TITLE_ONLY_KEY:
            ({ appVal, didDefault } = parseBoolean(rawVal, DEFAULT_TITLE_ONLY));
            break;
        case SETTING_BLOCKED_WORDS_KEY:
            ({ appVal, didDefault } = parseStringArray(rawVal, DEFAULT_BLOCKED_WORDS));
            break;
        case SETTING_MINIMUM_VOTES_KEY:
            ({ appVal, didDefault } = parseNumber(rawVal, DEFAULT_MINIMUM_VOTES));
            break;
        default:
            throw new Error(`unrecognized setting: key=${forKey}, rawVal=${rawVal}`);
    }
    logDebug(`rawSettingValueToAppValue: returning ${rawVal} -> ${JSON.stringify(appVal)}: didDefault=${didDefault}`);
    return {
        appVal,
        didDefault,
    };
}

function parseString(val, default_) {
    return defaultIfThrows(() => {
        if (typeof val === 'undefined' || val === null) {
            throw new Error(`missing or null value`);
        }
        return String(val).trim();
    }, default_);
}

function parseStringArray(val, default_) {
    return defaultIfThrows(() => {
        if (typeof val === 'undefined' || val === null) {
            throw new Error(`missing or null value`);
        }
        let ret = String(val);
        ret = ret.split(',').filter(w => !!w).map(w => parseString(w).appVal);
        return ret;
    }, default_);
}

function parseNumber(val, default_) {
    return defaultIfThrows(() => {
        if (typeof val === 'undefined' || val === null) {
            throw new Error(`missing or null value`);
        }
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

function parseBoolean(val, default_) {
    return defaultIfThrows(() => {
        if (typeof val === 'undefined' || val === null) {
            throw new Error(`missing or null value`);
        }
        let { appVal: valAsStr } = parseString(val, default_);
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
        const appVal = func();
        return {
            appVal,
            didDefault: false,
        };
    } catch (err) {
        logDebug(`defaultIfThrows: caught error parsing value, defaulting: err=${err.message}`);
        return {
            appVal: default_,
            didDefault: true,
        };
    }
}

function renderAppValueToSettingValue(appVal, forKey) {
    switch (forKey) {
        case SETTING_SUBREDDITS_KEY:
        case SETTING_BLOCKED_WORDS_KEY:
            return renderArrayToString(appVal);
        default:
            // String, Boolean, etc. fine to pass thru.
            return appVal;
    }
}

function renderArrayToString(ary) {
    return ary.join(',');
}

function populateAllSettings(source) {
    const blob = extensionAPI.settings.getAll() ?? {};
    const blobKeys = Object.keys(blob);
    logDebug(`populateAllSettings: starting: blobKeys.length=${blobKeys.length}`, blob);
    const allEntries = [
        // the 'undefined' value for each key will cause the default to be read.
        ...ALL_SETTING_KEYS.filter(k => !blobKeys.includes(k)).map((k, i) => [k, undefined]),
        ...Object.entries(blob),
    ];
    for (const [rawKey, rawVal] of allEntries) {
        doUpdateSetting(rawKey, rawVal);
    }
    logDebug(`populateAllSettings: finished: triggeredBy=${source}`, UserSettings);
}

const RUN_SINGLE_COMMAND_PREFIX = `${PLUGIN_FRIENDLY_NAME}: Retrieve posts from`;
const RUN_MULTIPLE_COMMAND_PREFIX = `${PLUGIN_FRIENDLY_NAME}: Retrieve`;

function formatCommandLabel(subreddit) {
    return `${RUN_SINGLE_COMMAND_PREFIX} ${subreddit}...`;
}

let lastInstalledSubreddits = [];

function installCommands() {
    if (lastInstalledSubreddits.length) {
        logWarn(`installCommand: previous commands not uninstalled first!`);
        lastInstalledSubreddits = [];
    }
    for (const subreddit of UserSettings.subreddits) {
        roamAlphaAPI.ui.commandPalette.addCommand({
            label: formatCommandLabel(subreddit),
            callback: () => { return runForSingleSubreddit(subreddit, 'command-palette'); },
        });
        lastInstalledSubreddits.push(subreddit);
        logDebug(`installCommands: installed subreddit=${subreddit}`);
    }
    roamAlphaAPI.ui.commandPalette.addCommand({
        label: `${RUN_MULTIPLE_COMMAND_PREFIX} all subreddits`,
        callback: () => { return runForAllSubreddits('command-palette'); },
    });
    logDebug(`installCommands: installed 'retrieve all'`);
}

function uninstallCommands() {
    roamAlphaAPI.ui.commandPalette.removeCommand({
        label: `${RUN_MULTIPLE_COMMAND_PREFIX} all subreddits`,
    });
    logDebug(`uninstallCommands: uninstalled 'retrieve all'`);
    for (const subreddit of lastInstalledSubreddits) {
        roamAlphaAPI.ui.commandPalette.removeCommand({
            label: formatCommandLabel(subreddit),
        });
        logDebug(`uninstallCommands: uninstalled ${subreddit}`);
    }
    lastInstalledSubreddits = [];
}

function reinstallCommands() {
    uninstallCommands();
    installCommands();
}

function onload({ extensionAPI: _extensionAPI }) {
    extensionAPI = _extensionAPI;
    extensionAPI.settings.panel.create(panelConfig);
    window.extensionAPI = extensionAPI; // TEMP
    populateAllSettings('onload');
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