# Registration voice guidance

The registration recording is `mines_guide.mp3`. Guidance is enabled in `js/config.js`:

```js
guidance: Object.freeze({enabled: true, src: './assets/audio/mines_guide.mp3'}),
```

Refresh the registration page. Guidance starts on the first Close or Claim click in the deposit popup. The voice controls let the visitor stop or replay it. The page stays silent before that click.

Replace the MP3 with the same filename, or update `guidance.src` to use another filename. Set `enabled` to `false` to disable guidance. Run `npm run build` again after changing the audio for a hosted build.
