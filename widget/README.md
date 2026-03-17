# KudosWall Widget

A lightweight, embeddable widget for displaying social proof mentions.

## Quick Start

### 1. Include the files

```html
<link rel="stylesheet" href="https://cdn.kudoswall.io/widget.css">
<script src="https://cdn.kudoswall.io/widget.js"></script>
```

### 2. Add the widget container

```html
<div id="kudoswall-widget" data-kudoswall="YOUR_PROJECT_ID"></div>
```

### 3. Configure (optional)

```html
<div 
  id="kudoswall-widget"
  data-kudoswall="YOUR_PROJECT_ID"
  data-theme="dark"
  data-layout="grid"
  data-max-items="6"
  data-autoplay="false"
></div>
```

## Manual Initialization

```javascript
const widget = KudosWall.init('kudoswall-widget', 'YOUR_PROJECT_ID', {
  theme: 'light',
  layout: 'carousel',
  maxItems: 10,
  autoPlay: true,
  apiUrl: 'https://api.kudoswall.io'
});

// Destroy widget
widget.destroy();
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `theme` | string | 'light' | Theme: 'light' or 'dark' |
| `layout` | string | 'carousel' | Layout: 'carousel', 'grid', or 'list' |
| `maxItems` | number | 10 | Maximum mentions to display |
| `autoPlay` | boolean | true | Auto-rotate carousel |
| `apiUrl` | string | 'https://api.kudoswall.io' | API base URL |

## Layouts

- **Carousel**: Rotating slides with navigation
- **Grid**: Responsive grid layout
- **List**: Vertical list layout

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

MIT
