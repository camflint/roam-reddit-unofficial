# Changelog
## [0.1.2] - 2022-08-06
### Added
- Support nesting all posts under a single node (with new setting).
### Changed
- Renamed all "Roam Reddit" strings to "Reddit Unofficial"
### Fixed
- Switch setting values correctly populate now.
- Default values are propagated back to UI on first use now.
- Posts with empty bodies are formatted correctly.
- The insertion node uses the `roamAlphaAPI` helpers now to select the active page or block, with fallback to today's daily notes page.

## [0.1.1] - 2022-08-01
### Added
- Support multiple subreddits and 'run all' command.
- Add 'number of posts' setting which controls the number of posts retrieved for each subreddit.

## [0.1.0] - 2022-08-01
### Added
- This is the very beginning of roam-reddit. It supports pulling Reddit posts from the subreddits of your choosing into your Roam graph, with some basic configuration options. See the [README](/README.md) for more details.