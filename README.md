Rich text editor built on Codemirror.

I made this since i was unable to find an editor that fit my needs.

Supports code highlights in all languages from codemirror which is why  
the end file will be fairly big (1.4mb).

Does not include stylings!

# How to install:

### Standalone:

1. `npm install`
2. `npm run build`
3. Copy the file `./dist/editor.js` to your server
4. Create a new editor e.g. with  
```javascript 
const editor = new MarkdownEditor(document.body)
```

### Via npm package:

1. `npm install https://github.com/Flemmli97/markdown-editor`
2. Create the editor e.g. with
```javascript
import { MarkdownEditor } from "markdown-editor"
const editor = new MarkdownEditor(document.body)
``` 