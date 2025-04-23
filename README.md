
# PhaseUp.AI - Phaser.js Game Code Optimizer

PhaseUp.AI is an interactive web application that helps game developers optimize and improve their Phaser.js game code through AI-powered suggestions and analysis.

![PhaseUp.AI](./assets/images/logo.png)

## Features

- **AI-Powered Code Suggestions**: Leverages Hugging Face AI models to analyze and improve your Phaser.js game code
- **Visual Diff System**: See exactly what changes are being suggested with highlighted code differences
- **Performance Metrics**: Visual feedback on how suggested changes impact CPU usage, memory consumption, and FPS
- **Real-time Code Execution**: Test your optimized code in a sandbox environment
- **Learning Assistant**: Access a library of optimization techniques and best practices for Phaser.js development
- **Code Pattern Detection**: Automatically identify common issues and anti-patterns in your code

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge recommended)
- Basic understanding of JavaScript and Phaser.js game development
- Internet connection for AI functionality (optional, but recommended)

### Installation

1. Clone this repository or download the ZIP file
```
git clone https://github.com/SHANMUGHA-PRIYAN-SK/PhaseUp.AI.git
```

2. Navigate to the project directory
```
cd PhaseUp.AI
```

3. Open `index.html` in your web browser
```
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

Alternatively, you can set up a local server:
```
# With Python 3
python -m http.server

# With Node.js
npx serve
```

## How to Use

### Basic Workflow

1. **Input Your Code**: Paste your Phaser.js game code into the left editor panel
2. **Set Optimization Goal**: Enter a specific request in the prompt field (e.g., "optimize movement", "add collision", "improve rendering")
3. **Generate Suggestions**: Click the "Suggest Changes" button to have the AI analyze your code
4. **Review Changes**: Examine the suggested optimizations in the middle panel and the visual diff below
5. **Check Performance Impact**: Review the estimated performance metrics chart
6. **Test the Code**: Use the "Execute Code" button to test the optimized code in a sandbox
7. **Apply Changes**: Click "Integrate Changes" to apply the suggested optimizations to your code

### Advanced Features

#### AI Model Selection

- Choose from different AI models in the settings panel for specialized optimization tasks
- Adjust temperature to control the creativity of the AI's suggestions
- Add your own Hugging Face API key for higher rate limits and model access

#### Learning Assistant

- Browse through optimization lessons by using the "Previous" and "Next" buttons
- Review code examples showing before and after optimization techniques
- Access documentation links for more in-depth information about each technique
- Study best practices for each optimization scenario

#### Demo Game

- Click "View Complex Demo Game" to see a comprehensive example of optimized game code
- Examine the performance comparison between optimized and unoptimized versions
- Load the demo code into the editor to experiment with further optimizations

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript
- **Code Editing**: CodeMirror
- **Game Engine**: Phaser.js
- **AI Integration**: Hugging Face Inference API
- **Visualization**: Chart.js

## Troubleshooting

### AI Connection Issues

If you encounter problems with AI suggestions:

1. Check your internet connection
2. Verify that the Hugging Face script is loading properly
3. Try adding your own API key in the settings panel
4. The system will automatically fall back to rule-based optimizations if AI is unavailable

### Performance Issues

If the application is running slowly:

1. Try a different web browser
2. Reduce the size of code being analyzed
3. Close other resource-intensive applications

## Additional Resources

- [Phaser.js Documentation](https://phaser.io/docs)
- [Hugging Face Models](https://huggingface.co/models)
- [Game Development Optimization Techniques](https://phaser.io/learn)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Phaser.js community
- Hugging Face for AI models
- All contributors to the open-source libraries used in this project 
