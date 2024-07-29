# Obsidian Dev Utils

This is the collection of useful functions that you can use for your Obsidian plugin development.

## Usage

- Install it from NPM `npm install obsidian-dev-utils`.
- Then you use in your plugin

```typescript
import { getCacheSafe } from "obsidian-dev-utils/MetadataCache";
const cache = await getCacheSafe(file);
```

## License

© [Michael Naumov](https://github.com/mnaoumov/)
