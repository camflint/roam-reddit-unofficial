# roam-reddit

Free unofficial Reddit plug-in for Roam Research. It's intended to pull one post at a time from a subreddit of your chosing into your daily notes page: like from r/LifeProTips, r/todayilearned, etc.

## Usage

The easiest way to access the plugin's features is via the Command Palette. First put your cursor where you want the blocks to be inserted. Then just press `Cmd+P` (`Ctrl+P` on Windows) and start typing "Reddit" to see a list of supported commands.

![image](https://user-images.githubusercontent.com/2079548/182274952-965f5721-8c7f-4939-8a4c-59d5be3f08cf.png)

## Installation

There are two ways of installing roam-reddit into your Roam graph. Unless you're a developer, the best option is to install it through the official Roam Depot.

## Developer mode
To install the plug-in manually:

1. Open the Settings panel and select "Roam Depot" on the left-hand side.
2. Click on the gear menu on the right side of the "Installed Extensions" section, then click "Enable developer mode."
3. Click on the folder with the plus icon in the "Developer Extensions" section that appears.
4. Navigate to the folder containing this repo's source code.

![CleanShot 2022-07-31 at 23 57 02@2x](https://user-images.githubusercontent.com/2079548/182091080-679f8b78-4698-40bd-ada5-f4b03986a4ad.png)

## Configuration

The following settings are supported:

* **Subreddit**: Specify the subreddit you'd like to pull posts from. _(Required.)_
* **Sort**: Select the sorting order, which should be one of the supported sorting options on Reddit itself (e.g. Top, Rising, New, Random, etc.). _(Optional, defaults to Rising.)_
* **Number of posts**: The number of posts to retrieve for each subreddit. _(Optional, defaults to 1.)_
* **Hashtag**: If you'd like each post to be tagged using a custom keyword, so that you can locate all the Reddit content in your graph for instance. A value like "#roam-reddit" works well. _(Optional.)_
* **Group**: Toggle this option to nest all inserted posts under a root node. The content of the root node will be the **hashtag** if it is present.
* **Title only**: Toggle this option to only pull the title of the post (rather than the title+body).
* **Blocked words**: A comma-separated list of filter words. _(Optional.)_
* **Minimum upvotes**: The minimum votes a post must have received. _(Optional, defaults to zero.)_

## Support

I developed this plug-in in my free time because (a) I wanted to learn and (b) it's useful to my everday workflow. I can't promise any support, but if you encounter any issues, feel free to open an issue on GitHub anyway, and if I have time I'll respond.

## Roadmap
In the future, I'd love to add the ability to draft and submit Reddit posts directly from Roam.

## Technical troubleshooting

The code is thoroughly instrumented with debug logs, but they won't be immediately visible in the Developer Tools -> Console window. To reveal them, first open the developer tools in your Chromium-based browser, then make sure the "Verbose" level is checked on the right hand side of the Console tab.
