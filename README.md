# roam-reddit-unofficial

Read-only unofficial Reddit plug-in for Roam Research. It's intended to pull a select number of posts at a time from one or more subreddit(s) of your chosing into your daily notes page, or the currently focused page/block.

Useful for subreddits like from `r/lifeprotips`, `r/todayilearned`, or your own favorites.

## Usage

The easiest way to access the plugin's features is via the Command Palette. First put your cursor where you want the blocks to be inserted. Then just press `Cmd+P` (`Ctrl+P` on Windows) and start typing "Reddit" to see a list of supported commands.

<img width="785" alt="CleanShot 2022-08-06 at 18 00 29@2x" src="https://user-images.githubusercontent.com/2079548/183270762-1b207a99-35f9-4bf9-925e-4088c0d69c9e.png">

![image](https://user-images.githubusercontent.com/2079548/183270778-50f992f2-3673-42c7-9bb6-3ce8adb314e3.png)

## Installation

There are two ways of installing roam-reddit-unofficial into your Roam graph. Unless you're a developer, the best option is to install it through the official Roam Depot (once it has been approved there).

## Developer mode
To install the plug-in manually, follow these steps:

1. Check out this repo to a local folder on your hard disk.
1. Open the Settings panel and select "Roam Depot" on the left-hand side.
1. Click on the gear icon on the right side of the "Installed Extensions" section, then click "Enable developer mode" in the drop-down menu.
1. Click on the folder icon that has a plus sign on the right side of the "Developer Extensions" section that appears.
1. Navigate to the folder containing this repo's source code.
1. Notice that a new settings section for the plugin appears on the left sidebar.

## Configuration

The following settings are supported:

* **Subreddits**: Specify the subreddits(s) you'd like to pull posts from, separated by commas. _(Required.)_
* **Sort**: Select the sorting order, which should be one of the supported sorting options on Reddit itself (e.g. top, rising, new, random, etc.). _(Optional, defaults to Rising.)_
* **Number of posts**: The number of posts to retrieve for each subreddit. _(Optional, defaults to 1.)_
* **Hashtag**: A custom keyword to tag each block with, so that you can locate all the Reddit content in your graph. A value like "#roam-reddit" works well. This value is also used together with the `group` setting (see below). _(Optional, defaults to `#reddit-unofficial`.)_
* **Group**: Toggle this option to nest all inserted posts under a parent node. The content of the root node will be the **hashtag** if it is present. _(Optional, defaults to true.)_
* **Title only**: Toggle this option to only pull in the title of the post (rather than the title and body together. _(Optional, defaults to false.)_
* **Blocked words**: A comma-separated list of filter words. _(Optional, defaults to none.)_
* **Minimum upvotes**: The minimum votes a post must have received to be included in the filter. _(Optional, defaults to zero.)_

![image](https://user-images.githubusercontent.com/2079548/183270770-773a0d8d-3ff3-4e65-8b93-2527ae02383b.png)

## Support

I developed this plug-in in my free time because (a) I wanted to learn and (b) it's useful to my everday workflow. I can't promise any support, but if you encounter any issues, feel free to open an issue on GitHub anyway, and if I have time I'll respond.

If you do submit an issue, please include the logs (see "technical troubleshooting" for instructions below).

## Roadmap

In the future, I'd love to add the ability to draft and submit Reddit posts directly from within Roam.

## Technical troubleshooting

The code is thoroughly instrumented with debug logs, but they won't be immediately visible in the Developer Tools -> Console window. To reveal them, first open the developer tools in your Chromium-based browser, then make sure the "Verbose" level is checked on the right hand side of the Console tab.

![CleanShot 2022-08-06 at 12 10 40@2x](https://user-images.githubusercontent.com/2079548/183263001-6378a5ae-11a3-49cc-8173-336c38f0d407.png)

