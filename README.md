# Linkding Bookmarks for Raycast

A [Raycast](https://www.raycast.com/) extension for saving a page to a self-hosted [linkding](https://linkding.link/) server.

> **Status:** implemented. Tests, typecheck, ESLint, and Prettier run in CI. This is a personal build, not a Raycast Store submission. `ray build` needs macOS or Windows.

## Features

- **Two commands** - Add Bookmark and Repeat Bookmark. No search, browsing, or management commands.
- **Clipboard prefill** - copy a link, launch either command, and the URL is already in the form, ready for tags.
- **Repeat last settings** - Repeat Bookmark prefills the tags and read status from the last successful save, so saving a batch of pages takes fewer keystrokes.
- **Read status** - a read/unread toggle that defaults to **unread**; press `⌘R` (`Ctrl+R` on Windows) to flip it.
- **Tags** - a fuzzy-searchable multi-select populated from the tag list configured in the extension preferences.
- **Direct to linkding** - the bookmark is created through the linkding REST API using the server URL and API token from preferences.
- **Calm feedback** - a single toast shows the save in progress, becomes the error on failure, and disappears on success without a confirmation.
- **Drafts** - closing the window with unsaved input saves a draft, and the next launch starts from it.

## Command

| Command             | Mode | Description                                                                                                                       |
| ------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Add Bookmark**    | view | Opens a form with URL, read status, and tags, prefilling the URL from the clipboard. Submitting creates the bookmark in linkding. |
| **Repeat Bookmark** | view | Opens the same form, taking the URL from the clipboard and prefilling the tags and read status from the last successful save.     |

### Usage

1. Copy the page URL to the clipboard.
2. Launch **Add Bookmark** from Raycast. The URL is carried into the form.
3. Pick a read status (or press `⌘R`, `Ctrl+R` on Windows) and any tags, then submit.

Launch **Repeat Bookmark** instead when the next page should reuse the tags and read status from your last successful save. Only tags still listed in the preferences are kept, and without a previous save it behaves like **Add Bookmark**.

When the clipboard does not contain a URL, the form opens with an empty URL field, so a link can be typed or pasted there instead.

### Feedback

The form opens immediately with the URL field focused. The clipboard URL and last-save settings fill in as they arrive without a loading bar, and they never overwrite input you have already typed. Submitting shows a "Saving bookmark" toast for as long as the request runs, including a timeout, so the window never looks idle. On success that toast disappears and the window closes. On failure the same toast becomes the error, so the message appears once. A rejected token also offers **Open Extension Preferences** from the toast and moves that action to the top of the action panel.

If you close the window with unsaved input, Raycast stores it as a draft. Launching the command again starts from that draft instead of the clipboard or the last saved settings.

The loading and success behavior follows [A Simple Guide to Calm UI](https://maxschmitt.me/posts/calm). Failures reuse the loader toast, so the error stays prominent without a second message in the form.

## Form

| Field           | Required | Default                          | Notes                                                                                                 |
| --------------- | -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **URL**         | yes      | clipboard value, or empty        | Must be a valid absolute URL. `https://` is added when the scheme is missing. Focused at launch.      |
| **Tags**        | no       | none, or the last saved tags     | Multi-select from the configured tag list; type to filter. Focused when the clipboard provides a URL. |
| **Read status** | yes      | Unread, or the last saved status | Toggles between read and unread. `⌘R` (`Ctrl+R` on Windows) toggles it from the action panel.         |

## Preferences

| Preference     | Type       | Required | Purpose                                                                                                                                                               |
| -------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server URL** | text field | yes      | Base URL of the linkding instance, for example `https://linkding.example.com` or `http://192.168.1.10:9090`. A full `/api/bookmarks/` URL is accepted and normalized. |
| **API Token**  | password   | yes      | Token from linkding's **Settings** page. Sent as `Authorization: Token <token>`.                                                                                      |
| **Tags**       | text field | no       | Comma-separated list of tags offered in the form, for example `dev, reading, work`.                                                                                   |

The token is stored as a Raycast preference and never written to the repository or logs. Only tags from the configured list are offered in the form.

## Requirements

- A running linkding instance reachable from the machine running Raycast
- An API token generated by linkding (Settings → API token)
- HTTPS is recommended for anything other than a trusted local network, because the API token travels in a request header

## How it works

The extension sends a single `POST /api/bookmarks/` request with `url`, `unread`, and `tag_names`. There is no local database and no intermediary service: the configured server URL is normalized once (trimmed, a missing scheme becomes `https`, trailing slashes and a `/api/bookmarks/` suffix are removed, `/api` is appended) and called directly. If the URL is already bookmarked, linkding updates that bookmark instead of creating a duplicate. The API contract is documented at <https://linkding.link/api/>.

Both commands remember the tags and read status of the most recent successful save in Raycast LocalStorage. **Repeat Bookmark** reads that snapshot on launch; bookmarks themselves are never stored locally.

## Development

```bash
npm install        # install dependencies
npm run dev        # ray develop - live reload inside Raycast (macOS/Windows)
npm run build      # ray build
npm run lint       # ray lint
npm run fix-lint   # ray lint --fix
npm test           # vitest run
```

`ray build` and `ray dev` require macOS or Windows. CI runs tests, typecheck, ESLint, and Prettier on Linux on every push and pull request. `ray lint` additionally validates Raycast Store metadata; this is a personal build, so that check is not used.

## License

MIT - see [LICENSE](LICENSE).
