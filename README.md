# Welcome to the NPD App Source Code

This codebase is several projects wrapped into one, and the script to build them all together automatically is a work in progress.  Includes:

1. **NPD-Server:** (`./server`) Back-End Node/Express/DiscordJS Typescript application to serve the static UI resources, conduct backend data operations to support them, and act as a client for the NPD Bot on Discord.  The Bot is intended to be configurable by modifying/supplementing its `./assets`, but is still likely very tightly coupled to the NPD's Discord Server and will require substantial alteration to be useful elsewhere.
2. **Main:** (`./main`) Front-End React Typescript application that might one day supplant the Blogger site as the NPD's website.  This doesn't really do anything at the moment other than providing a web interface to enable and disable the Discord Bot so that when multiple clients are running in different environments, the Bot is not duplicating event responses.
3. **NPD Legislator Lookup Widget:** (`./widgets/NpdLegWidget`) The first of hopefully many "widgets" served by the **NPD-Server** to be embedded elsewhere and facilitate political activities in Delaware.  Does not currently embed or even build inside this project but will run if you build it right.  Relies on the **NPD-Server** to retrieve information.

# Available Scripts

## `npm run dev`:

Runs the various dev servers on the local machine.  Is currently running the Widgets individually rather than on any kind of discovery script.  Concurrently will allegedly restart anything that fails after 15 seconds?

### `npm run dev:server`:

Specifically runs the server in dev mode using `nodemon` and the local `.env` file for environment variables.

### `npm run dev:main`:

Runs the main UI webpack dev server.

### `npm run dev:NpdLegWidget`:

Runs the NpdLegWidget UI webpack dev server.

## `npm run build`:

### `npm run build:local`:

### `npm run build:clean`:

### `npm run build:server`:

### `npm run build:main`:

### `npm run build:main:local`:

### `npm run build:widgets`:

### `npm run build:widgets:local`:

## `npm run prune`:

### `npm run prune:server`:

### `npm run prune:main`:

### `npm run prune:widgets`:

## `npm run heroku-postbuild`:

## `npm run prod`:

## `npm run local`:

*Charitable of you to assume any of them work...*
