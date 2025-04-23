// Initialize CodeMirror
let inputEditor, suggestedEditor, outputEditor;
let game;
let history = [];
let currentHistoryIndex = -1;
let diffViewMode = 'split'; // 'split' or 'unified'
let performanceMetrics = {};
let performanceChart;
let currentLessonIndex = 0;

// Initialize Hugging Face client (without API key for demo - will use rate-limited public access)
let hfInference = null;

// Create a function to initialize the HF client that can be called after page load
function initializeHuggingFace(apiKey = null) {
    try {
        if (typeof HfInference === 'undefined') {
            console.error("HfInference is not defined. Make sure the Hugging Face script is loaded.");
            return false;
        }
        
        // Try to create the client with or without an API key
        if (apiKey) {
            hfInference = new HfInference(apiKey);
        } else {
            hfInference = new HfInference();
        }
        
        console.log("Hugging Face inference client initialized successfully");
        
        // Update UI to show successful connection
        const aiModelBadge = document.getElementById('aiModelBadge');
        if (aiModelBadge) {
            aiModelBadge.textContent = "Hugging Face Connected";
            aiModelBadge.classList.remove('bg-red-600');
            aiModelBadge.classList.add('bg-green-600');
        }
        
        return true;
    } catch (error) {
        console.error("Failed to initialize Hugging Face client:", error);
        
        // Update UI to show connection failure
        const aiModelBadge = document.getElementById('aiModelBadge');
        if (aiModelBadge) {
            aiModelBadge.textContent = "AI Unavailable";
            aiModelBadge.classList.remove('bg-green-600');
            aiModelBadge.classList.add('bg-red-600');
        }
        
        return false;
    }
}

// Attempt to initialize after a slight delay to ensure the script is loaded
setTimeout(() => {
    if (!hfInference) {
        initializeHuggingFace();
    }
}, 1000);

// AI Model configuration
const aiModelConfig = {
    defaultModel: "codellama/CodeLlama-7b-hf",
    temperature: 0.7,
    maxLength: 2048,
    models: {
        "codellama/CodeLlama-7b-hf": {
            description: "Code Llama 7B - Good for general code improvements",
            temperature: 0.7,
            maxLength: 2048
        },
        "bigcode/starcoder": {
            description: "StarCoder - Specialized for JavaScript and web development",
            temperature: 0.8,
            maxLength: 1024
        },
        "google/gemma-2b": {
            description: "Gemma 2B - Lightweight and fast",
            temperature: 0.9,
            maxLength: 512
        }
    }
};

// Prompt templates for different improvement tasks
const promptTemplates = {
    general: `You are an expert Phaser.js developer. 
Improve the following JavaScript code for a Phaser.js game according to best practices.
Focus on the following request: {prompt}

Original code:
\`\`\`javascript
{code}
\`\`\`

Please provide the improved code with full context, not just the parts that changed.`,

    optimize: `You are an expert in Phaser.js game optimization.
The following code has performance issues. Improve it by optimizing for better performance.
Request: {prompt}

Original code:
\`\`\`javascript
{code}
\`\`\`

Return the optimized code with a brief explanation of the improvements made.`,

    addFeature: `You are an expert Phaser.js game developer.
Enhance the following code by adding the requested feature: {prompt}

Original code:
\`\`\`javascript
{code}
\`\`\`

Return the enhanced code with the new feature fully implemented.`
};

// AI-generated performance metrics estimation (will replace the rule-based metrics)
function estimatePerformanceImpact(originalCode, improvedCode, explanation) {
    // Default estimates
    let impact = {
        cpu: 0,
        memory: 0,
        fps: 0
    };
    
    // Look for optimization clues in the improved code and explanation
    if (/setVelocityX|setVelocityY/.test(improvedCode) && !/setVelocity\(\s*\d+\s*,\s*\d+\s*\)/.test(improvedCode)) {
        impact.cpu -= 10;
        impact.fps += 5;
    }
    
    if (/sprite sheet|spritesheet|atlas/.test(improvedCode) || /sprite sheet|spritesheet|atlas/.test(explanation)) {
        impact.memory -= 15;
        impact.fps += 8;
    }
    
    if (/collision|collider|overlap/.test(improvedCode) && !/collision|collider|overlap/.test(originalCode)) {
        impact.cpu += 5;
        impact.fps -= 2;
    }
    
    if (/preload|preloading/.test(improvedCode) && !/preload|preloading/.test(originalCode)) {
        impact.memory += 10;
        impact.fps += 10;
    }
    
    if (/animation|anim\.create/.test(improvedCode) && !/animation|anim\.create/.test(originalCode)) {
        impact.cpu += 5;
        impact.memory += 5;
        impact.fps -= 2;
    }
    
    if (/cache|caching/.test(improvedCode) || /cache|caching/.test(explanation)) {
        impact.cpu -= 8;
        impact.memory += 5;
    }
    
    if (/destroy|cleanup/.test(improvedCode) && !/destroy|cleanup/.test(originalCode)) {
        impact.memory -= 20;
    }
    
    // Complex pattern detection based on explanation
    if (/performance|optimize|faster|efficient/.test(explanation)) {
        impact.cpu -= 5;
        impact.fps += 3;
    }
    
    // Cap values to reasonable ranges
    impact.cpu = Math.max(Math.min(impact.cpu, 30), -30);
    impact.memory = Math.max(Math.min(impact.memory, 30), -30);
    impact.fps = Math.max(Math.min(impact.fps, 15), -15);
    
    return impact;
}

// Legacy AI Rules for Phaser.js improvements (kept for fallback)
const aiRules = {
    'optimize movement': {
        pattern: /this\.sprite\.setVelocity\((\d+),\s*(\d+)\)/,
        replacement: (match, x, y) => `this.sprite.setVelocityX(${x});\nthis.sprite.setVelocityY(${y});`,
        explanation: 'Split velocity into X and Y components for better control and performance',
        docLink: 'https://phaser.io/docs/2.6.2/Phaser.Physics.Arcade.Body.html#setVelocity',
        performanceImpact: {
            cpu: -15, // Reduces CPU usage by 15%
            memory: 0,
            fps: +5   // Increases FPS by 5
        }
    },
    'add collision': {
        pattern: /this\.sprite\s*=\s*this\.physics\.add\.sprite\((\d+),\s*(\d+),\s*['"](.+)['"]\)/,
        replacement: (match, x, y, key) => 
            `${match}\nthis.physics.add.collider(this.sprite, this.platforms, this.handleCollision, null, this);`,
        explanation: 'Added collision detection between sprite and platforms',
        docLink: 'https://phaser.io/docs/2.6.2/Phaser.Physics.Arcade.html#collider',
        performanceImpact: {
            cpu: +5,  // Increases CPU usage by 5%
            memory: +2,
            fps: -2   // Decreases FPS by 2
        }
    },
    'optimize rendering': {
        pattern: /this\.add\.image\((\d+),\s*(\d+),\s*['"](.+)['"]\)/g,
        replacement: (match, x, y, key) => 
            `// Using sprite sheet instead of individual images
const texture = this.textures.get('${key}');
if (!texture.frameTotal) {
    this.add.sprite(${x}, ${y}, '${key}');
} else {
    ${match}
}`,
        explanation: 'Added sprite sheet optimization to improve rendering performance',
        docLink: 'https://phaser.io/docs/2.6.2/Phaser.GameObjects.Sprite.html',
        performanceImpact: {
            cpu: -10,
            memory: -20,
            fps: +8
        }
    },
    'add animation': {
        pattern: /this\.player\s*=\s*this\.physics\.add\.sprite\((\d+),\s*(\d+),\s*['"](.+)['"]\)/,
        replacement: (match, x, y, key) => 
`${match}

// Add animations
this.anims.create({
    key: 'left',
    frames: this.anims.generateFrameNumbers('${key}', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
});

this.anims.create({
    key: 'turn',
    frames: [ { key: '${key}', frame: 4 } ],
    frameRate: 20
});

this.anims.create({
    key: 'right',
    frames: this.anims.generateFrameNumbers('${key}', { start: 5, end: 8 }),
    frameRate: 10,
    repeat: -1
});`,
        explanation: 'Added player animations for smoother movement',
        docLink: 'https://phaser.io/docs/2.6.2/Phaser.Animations.AnimationManager.html#create',
        performanceImpact: {
            cpu: +5,
            memory: +10,
            fps: -3
        }
    },
    'add preload': {
        pattern: /create\(\) {/,
        replacement: (match) => 
`preload() {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('ground', 'assets/platform.png');
    this.load.spritesheet('player', 
        'assets/player.png',
        { frameWidth: 32, frameHeight: 48 }
    );
}

${match}`,
        explanation: 'Added asset preloading for better game initialization',
        docLink: 'https://phaser.io/docs/2.6.2/Phaser.Loader.LoaderPlugin.html',
        performanceImpact: {
            cpu: 0,
            memory: +15,
            fps: +10
        }
    }
};

// Example codes for predefined scenarios
const exampleCodes = {
    movement: {
        code: `class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Create player sprite
        this.sprite = this.physics.add.sprite(100, 100, 'player');
        
        // Set velocity directly
        this.sprite.setVelocity(100, 200);
        
        // Set up cursor keys
        this.cursors = this.input.keyboard.createCursorKeys();
    }
    
    update() {
        // Simple movement
        if (this.cursors.left.isDown) {
            this.sprite.x -= 5;
        }
        else if (this.cursors.right.isDown) {
            this.sprite.x += 5;
        }
    }
}`,
        prompt: "optimize movement"
    },
    collision: {
        code: `class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Create platforms
        this.platforms = this.physics.add.staticGroup();
        this.platforms.create(400, 568, 'platform').setScale(2).refreshBody();
        
        // Create player sprite
        this.sprite = this.physics.add.sprite(100, 100, 'player');
        
        // Set up cursor keys
        this.cursors = this.input.keyboard.createCursorKeys();
    }
    
    update() {
        // Simple movement
        if (this.cursors.left.isDown) {
            this.sprite.x -= 5;
        }
        else if (this.cursors.right.isDown) {
            this.sprite.x += 5;
        }
    }
}`,
        prompt: "add collision"
    },
    rendering: {
        code: `class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Create multiple image objects
        this.add.image(400, 300, 'sky');
        this.add.image(400, 300, 'star');
        this.add.image(200, 200, 'diamond');
        this.add.image(300, 200, 'bomb');
        
        // Create player
        this.player = this.physics.add.sprite(100, 450, 'player');
    }
    
    update() {
        // Game logic
    }
}`,
        prompt: "optimize rendering"
    },
    animation: {
        code: `class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Create player without animations
        this.player = this.physics.add.sprite(100, 450, 'player');
        
        // Set up cursor keys
        this.cursors = this.input.keyboard.createCursorKeys();
    }
    
    update() {
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160);
        } else {
            this.player.setVelocityX(0);
        }
    }
}`,
        prompt: "add animation"
    },
    preload: {
        code: `class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Create game elements without preloading
        this.platforms = this.physics.add.staticGroup();
        this.player = this.physics.add.sprite(100, 450, 'player');
    }
    
    update() {
        // Game logic
    }
}`,
        prompt: "add preload"
    }
};

// Code pattern detection
const phaserPatterns = {
    noPreload: {
        pattern: /class\s+\w+\s+extends\s+Phaser\.Scene\s*{(?![^}]*preload\s*\(\s*\))/,
        suggestion: 'Your scene is missing a preload() method. Adding preload will ensure assets are properly loaded.',
        priority: 'high'
    },
    directSetXY: {
        pattern: /\.\w+\.x\s*=|\.\w+\.y\s*=/g,
        suggestion: 'Consider using setPosition() instead of directly setting x/y properties for better performance.',
        priority: 'medium'
    },
    missingDestroy: {
        pattern: /new\s+\w+\(/g,
        counterPattern: /\.destroy\(\)/,
        suggestion: 'Game objects are created but might not be destroyed, potentially causing memory leaks.',
        priority: 'high'
    },
    updateLoop: {
        pattern: /update\s*\(\s*\)\s*{[^}]*for\s*\(/,
        suggestion: 'Using loops in the update method can cause performance issues. Consider optimizing.',
        priority: 'high'
    }
};

// Create a collection of learning lessons
const learningLessons = [
    {
        title: "Velocity Optimization",
        explanation: "Using setVelocityX() and setVelocityY() separately instead of setVelocity() allows Phaser to optimize internal calculations and reduce CPU overhead. This is especially important for games with many moving objects.",
        beforeCode: `// Before: Using combined velocity
this.sprite.setVelocity(100, 200);
// This requires Phaser to process both components even when only one changes`,
        afterCode: `// After: Using separate velocity components
this.sprite.setVelocityX(100);
this.sprite.setVelocityY(200);
// This allows Phaser to optimize when only one component changes`,
        docs: [
            { text: "Arcade Physics Velocity", url: "https://phaser.io/docs/2.6.2/Phaser.Physics.Arcade.Body.html#velocity" },
            { text: "setVelocityX Method", url: "https://phaser.io/docs/2.6.2/Phaser.Physics.Arcade.Body.html#setVelocityX" }
        ],
        practices: [
            "Update only the velocity components that need changing",
            "Use setVelocity for initial setup, but component methods during gameplay",
            "Combine with delta time for frame-rate independent movement"
        ]
    },
    {
        title: "Sprite Sheet Optimization",
        explanation: "Using sprite sheets instead of individual images reduces draw calls to the GPU, decreases memory usage, and improves loading times. This is a critical optimization for games with many visual elements.",
        beforeCode: `// Before: Using multiple individual images
this.add.image(100, 100, 'player1');
this.add.image(200, 100, 'player2');
this.add.image(300, 100, 'player3');
// Each image requires a separate texture and draw call`,
        afterCode: `// After: Using a sprite sheet
this.load.spritesheet('player', 'assets/player_sheet.png', { 
    frameWidth: 64, 
    frameHeight: 64 
});
// Later in create():
this.add.sprite(100, 100, 'player', 0);
this.add.sprite(200, 100, 'player', 1);
this.add.sprite(300, 100, 'player', 2);`,
        docs: [
            { text: "Using Sprite Sheets", url: "https://phaser.io/docs/2.6.2/Phaser.GameObjects.Sprite.html" },
            { text: "Texture Manager", url: "https://phaser.io/docs/2.6.2/Phaser.Textures.TextureManager.html" }
        ],
        practices: [
            "Pack related images into a single sprite sheet",
            "Use texture atlases for irregularly-sized sprites",
            "Keep sprite sheet dimensions to powers of 2 (e.g., 512×512, 1024×1024)"
        ]
    },
    {
        title: "Object Pooling",
        explanation: "Object pooling reuses game objects instead of constantly creating and destroying them. This reduces garbage collection pauses and improves performance, especially for frequently spawned objects like bullets or particles.",
        beforeCode: `// Before: Creating new objects every time
function fireBullet() {
    // Creates a new bullet each time
    const bullet = this.physics.add.sprite(player.x, player.y, 'bullet');
    bullet.setVelocity(200, 0);
    
    // Object gets destroyed later
    this.time.delayedCall(2000, () => bullet.destroy());
}`,
        afterCode: `// After: Using object pooling
function createBulletPool() {
    // Create a group for bullets
    this.bullets = this.physics.add.group({
        defaultKey: 'bullet',
        maxSize: 20
    });
}

function fireBullet() {
    // Get a bullet from the pool
    const bullet = this.bullets.get(player.x, player.y);
    
    if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.setVelocity(200, 0);
        
        // Return to pool instead of destroying
        this.time.delayedCall(2000, () => {
            bullet.setActive(false).setVisible(false);
        });
    }
}`,
        docs: [
            { text: "Phaser Group", url: "https://phaser.io/docs/2.6.2/Phaser.GameObjects.Group.html" },
            { text: "Object Pooling", url: "https://phaser.io/examples/v3/view/game-objects/group/get-children" }
        ],
        practices: [
            "Pre-allocate pools for frequently created/destroyed objects",
            "Use setActive/setVisible instead of destroy()",
            "Size your pools based on maximum expected simultaneous objects"
        ]
    },
    {
        title: "Optimized Collision Detection",
        explanation: "Phaser's collision system can be optimized by using the right collision methods and limiting checks to only what's necessary. This significantly reduces CPU usage in games with complex physics.",
        beforeCode: `// Before: Checking all objects against each other
update() {
    // Inefficient - checks everything against everything else
    this.physics.world.collide();
    
    // Manually checking many sprites
    for (let i = 0; i < this.enemies.length; i++) {
        for (let j = 0; j < this.bullets.length; j++) {
            this.physics.overlap(this.enemies[i], this.bullets[j], this.hitEnemy);
        }
    }
}`,
        afterCode: `// After: Using collision groups and spatial hashing
create() {
    // Set up collision groups
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    
    // Set up collision once
    this.physics.add.overlap(this.enemies, this.bullets, this.hitEnemy, null, this);
}

update() {
    // No need to check collisions manually - Phaser handles it efficiently
}`,
        docs: [
            { text: "Collision System", url: "https://phaser.io/docs/2.6.2/Phaser.Physics.Arcade.html#collide" },
            { text: "Arcade Physics", url: "https://phaser.io/docs/2.6.2/Phaser.Physics.Arcade.ArcadePhysics.html" }
        ],
        practices: [
            "Group similar objects for collision detection",
            "Use colliders in create() instead of update() when possible",
            "Set smaller hitbox areas with setSize() and setOffset()"
        ]
    },
    {
        title: "Efficient Animation Management",
        explanation: "Properly managing animations can significantly improve performance. Creating them once and reusing animation keys reduces memory usage and improves sprite rendering speed.",
        beforeCode: `// Before: Creating animations for each sprite
create() {
    this.player1 = this.add.sprite(100, 100, 'player');
    this.player2 = this.add.sprite(200, 100, 'player');
    
    // Inefficiently creating same animations twice
    this.anims.create({
        key: 'player1_run',
        frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });
    
    this.anims.create({
        key: 'player2_run',
        frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });
    
    this.player1.play('player1_run');
    this.player2.play('player2_run');
}`,
        afterCode: `// After: Creating animations once and reusing them
create() {
    // Create animation once
    this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });
    
    // Create sprites and reuse the same animation
    this.player1 = this.add.sprite(100, 100, 'player').play('run');
    this.player2 = this.add.sprite(200, 100, 'player').play('run');
}`,
        docs: [
            { text: "Animation Manager", url: "https://phaser.io/docs/2.6.2/Phaser.Animations.AnimationManager.html" },
            { text: "Animation", url: "https://phaser.io/docs/2.6.2/Phaser.Animations.Animation.html" }
        ],
        practices: [
            "Create animations in a central place like a preload function",
            "Reuse animation keys across similar sprites",
            "Use frameRate wisely - higher isn't always better for performance"
        ]
    }
];

// Complex demo game configuration
const demoGame = {
    config: {
        title: "Space Defender - Optimization Showcase",
        description: "A complex game demonstrating multiple optimization techniques",
        optimizationScenarios: [
            "Sprite pooling for bullets and explosions",
            "Texture atlas for all game sprites",
            "Optimized collision detection",
            "Efficient animation management",
            "Background parallax with texture repeating"
        ],
        beforeMetrics: {
            fps: 32,
            drawCalls: 126,
            memory: "74 MB",
            loadTime: "2.4s"
        },
        afterMetrics: {
            fps: 58,
            drawCalls: 42,
            memory: "48 MB",
            loadTime: "0.8s"
        }
    },
    code: `class SpaceDefender extends Phaser.Scene {
    constructor() {
        super({ key: 'SpaceDefender' });
        this.score = 0;
        this.gameOver = false;
    }

    preload() {
        // Efficiently load everything as texture atlas
        this.load.atlas('gameSprites', 'assets/space_atlas.png', 'assets/space_atlas.json');
        this.load.image('background', 'assets/space_bg.png');
        this.load.audio('explosion', 'assets/explosion.mp3');
        this.load.audio('shoot', 'assets/laser.mp3');
    }

    create() {
        // Create repeating background with parallax
        this.bg1 = this.add.tileSprite(400, 300, 800, 600, 'background');
        this.bg2 = this.add.tileSprite(400, 300, 800, 600, 'gameSprites', 'stars_small');
        
        // Create pooled groups for game objects
        this.enemies = this.physics.add.group({
            defaultKey: 'gameSprites',
            defaultFrame: 'enemy1',
            maxSize: 20,
            createCallback: (enemy) => {
                enemy.setScale(0.6);
                enemy.body.setSize(enemy.width * 0.8, enemy.height * 0.8);
            }
        });
        
        this.bullets = this.physics.add.group({
            defaultKey: 'gameSprites',
            defaultFrame: 'laser',
            maxSize: 30,
            createCallback: (bullet) => {
                bullet.setScale(0.5);
            }
        });
        
        this.explosions = this.physics.add.group({
            defaultKey: 'gameSprites',
            defaultFrame: 'explosion1',
            maxSize: 10
        });
        
        // Create reusable animations once
        this.createAnimations();
        
        // Create player with physics body
        this.player = this.physics.add.sprite(400, 500, 'gameSprites', 'player');
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(this.player.width * 0.8, this.player.height * 0.8);
        
        // Set up optimized collision detection once
        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.gameOverHandler, null, this);
        
        // Set up efficient timed events
        this.enemyTimer = this.time.addEvent({
            delay: 800,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
        
        // Set up controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Set up firing cooldown using a flag instead of multiple timers
        this.canFire = true;
        
        // Add score display with single text object (more efficient than multiple texts)
        this.scoreText = this.add.text(16, 16, 'SCORE: 0', {
            fontSize: '18px',
            fill: '#fff'
        });
    }
    
    update() {
        if (this.gameOver) return;
        
        // Update backgrounds at different rates for parallax
        this.bg1.tilePositionY -= 0.5;
        this.bg2.tilePositionY -= 1;
        
        // Player movement with velocity for better physics integration
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-300);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(300);
        } else {
            this.player.setVelocityX(0);
        }
        
        // Fire bullets from object pool on spacebar
        if (this.fireKey.isDown && this.canFire) {
            this.fireBullet();
            this.canFire = false;
            this.time.delayedCall(250, () => {
                this.canFire = true;
            });
        }
        
        // Efficiently manage off-screen objects
        this.recycleBullets();
        this.recycleEnemies();
    }
    
    createAnimations() {
        // Create all animations once at startup
        this.anims.create({
            key: 'explode',
            frames: this.anims.generateFrameNames('gameSprites', {
                prefix: 'explosion',
                start: 1,
                end: 5,
                zeroPad: 1
            }),
            frameRate: 15,
            repeat: 0
        });
        
        this.anims.create({
            key: 'thrust',
            frames: this.anims.generateFrameNames('gameSprites', {
                prefix: 'player_thrust',
                start: 1,
                end: 2,
                zeroPad: 1
            }),
            frameRate: 8,
            repeat: -1
        });
    }
    
    fireBullet() {
        // Get bullet from object pool instead of creating new
        const bullet = this.bullets.get(this.player.x, this.player.y - 40);
        
        if (bullet) {
            bullet.setActive(true)
                .setVisible(true)
                .setVelocityY(-600);
                
            this.sound.play('shoot', { volume: 0.2 });
        }
    }
    
    spawnEnemy() {
        if (this.gameOver) return;
        
        // Get enemy from object pool
        const x = Phaser.Math.Between(50, 750);
        const enemy = this.enemies.get(x, -50);
        
        if (enemy) {
            enemy.setActive(true)
                .setVisible(true)
                .setVelocityY(Phaser.Math.Between(100, 200));
                
            // Vary enemy appearance using existing atlas frames
            const frame = 'enemy' + Phaser.Math.Between(1, 3);
            enemy.setFrame(frame);
        }
    }
    
    hitEnemy(bullet, enemy) {
        // Return objects to pool instead of destroying
        bullet.setActive(false).setVisible(false);
        enemy.setActive(false).setVisible(false);
        
        // Get explosion from pool
        const explosion = this.explosions.get(enemy.x, enemy.y);
        if (explosion) {
            explosion.setActive(true).setVisible(true);
            explosion.play('explode');
            
            // Listen once for animation completion
            explosion.once('animationcomplete', () => {
                explosion.setActive(false).setVisible(false);
            });
            
            this.sound.play('explosion', { volume: 0.2 });
        }
        
        // Update score efficiently by modifying text content
        this.score += 10;
        this.scoreText.setText('SCORE: ' + this.score);
    }
    
    recycleBullets() {
        // Efficiently recycle off-screen bullets
        this.bullets.getChildren().forEach(bullet => {
            if (bullet.active && bullet.y < -50) {
                bullet.setActive(false).setVisible(false);
            }
        });
    }
    
    recycleEnemies() {
        // Efficiently recycle off-screen enemies
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.y > 650) {
                enemy.setActive(false).setVisible(false);
            }
        });
    }
    
    gameOverHandler() {
        if (this.gameOver) return;
        
        this.gameOver = true;
        this.player.setTint(0xff0000);
        this.enemyTimer.remove();
        
        this.add.text(400, 300, 'GAME OVER', {
            fontSize: '64px',
            fill: '#fff',
            align: 'center'
        }).setOrigin(0.5);
        
        this.add.text(400, 380, 'Final Score: ' + this.score, {
            fontSize: '32px',
            fill: '#fff',
            align: 'center'
        }).setOrigin(0.5);
    }
}`
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize CodeMirror editors
    inputEditor = CodeMirror.fromTextArea(document.getElementById('inputCode'), {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        extraKeys: {
            'Ctrl-Z': 'undo',
            'Ctrl-Y': 'redo'
        }
    });

    suggestedEditor = CodeMirror.fromTextArea(document.getElementById('suggestedCode'), {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        readOnly: true
    });

    outputEditor = CodeMirror.fromTextArea(document.getElementById('outputCode'), {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        readOnly: true
    });

    // Initialize Phaser game
    initializeGame();

    // Add initial state to history
    addToHistory(inputEditor.getValue());

    // Add change event listener to input editor
    inputEditor.on('change', () => {
        addToHistory(inputEditor.getValue());
    });

    // Initialize example buttons
    initializeExampleButtons();

    // Add example code button if not already present
    addExampleCodeButton();
    
    // Initialize performance chart (with a slight delay to ensure DOM is ready)
    setTimeout(initializePerformanceChart, 100);
    
    // Initialize AI model selection
    initializeAIModelSettings();
    
    // Try to initialize Hugging Face client after DOM is loaded
    if (!hfInference) {
        setTimeout(() => initializeHuggingFace(), 500);
    }

    // Initialize Learning Assistant
    initializeLearningAssistant();
});

// Function to initialize the example buttons
function initializeExampleButtons() {
    // Make sure the example buttons work
    document.querySelectorAll('[onclick^="loadExample"]').forEach(button => {
        const type = button.getAttribute('onclick').match(/'([^']+)'/)[1];
        button.onclick = function() {
            loadExample(type);
        };
    });
}

function initializePerformanceChart() {
    try {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) {
            console.error('Performance chart element not found');
            return;
        }
        
        performanceChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['CPU Usage', 'Memory Usage', 'FPS Impact'],
                datasets: [{
                    label: 'Impact (%)',
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(75, 192, 192, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        console.log('Performance chart initialized successfully');
    } catch (error) {
        console.error('Error initializing performance chart:', error);
    }
}

function loadExample(type) {
    console.log('Loading example:', type);
    if (exampleCodes[type]) {
        const example = exampleCodes[type];
        inputEditor.setValue(example.code);
        document.getElementById('prompt').value = example.prompt;
    }
}

function addExampleCodeButton() {
    const inputCard = document.querySelector('.space-y-6 > div:first-child');
    if (!inputCard) {
        console.error('Input card element not found');
        return;
    }
    
    const existingButton = inputCard.querySelector('button[onclick="loadExampleCode()"]');
    if (existingButton) {
        // Button already exists
        return;
    }
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'mt-4 text-center';
    
    buttonContainer.innerHTML = `
        <button onclick="loadExampleCode()" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200">
            Load Example Code
        </button>
    `;
    
    inputCard.appendChild(buttonContainer);
}

function loadExampleCode() {
    const exampleCode = `class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        // Create player sprite
        this.sprite = this.physics.add.sprite(100, 100, 'player');
        
        // Set velocity directly
        this.sprite.setVelocity(100, 200);
        
        // Add some images
        this.add.image(300, 200, 'background');
        this.add.image(400, 300, 'star');
        
        // Set up cursor keys
        this.cursors = this.input.keyboard.createCursorKeys();
    }
    
    update() {
        // Simple movement
        if (this.cursors.left.isDown) {
            this.sprite.x -= 5;
        }
        else if (this.cursors.right.isDown) {
            this.sprite.x += 5;
        }
    }
}`;

    inputEditor.setValue(exampleCode);
}

function initializeGame() {
    try {
        // Check if there's an existing game instance
        if (game) {
            game.destroy(true);
        }
        
        const config = {
            type: Phaser.AUTO,
            parent: 'gameCanvas',
            width: 800,
            height: 600,
            backgroundColor: '#2d2d2d',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 300 },
                    debug: false
                }
            },
            scene: {
                create: create,
                update: update
            }
        };

        game = new Phaser.Game(config);
    } catch (error) {
        console.error('Error initializing game:', error);
    }
}

function create() {
    try {
        // Basic text to show the game is working
        this.add.text(400, 300, 'Game Preview', {
            fontSize: '32px',
            fill: '#fff'
        }).setOrigin(0.5);
        
        // Create platforms if we can
        if (this.physics && this.physics.add) {
            this.platforms = this.physics.add.staticGroup();
            this.platforms.create(400, 568, 'platform').setScale(2).refreshBody();
            
            // Create player if we can
            try {
                this.player = this.physics.add.sprite(100, 450, 'player');
                this.player.setBounce(0.2);
                this.player.setCollideWorldBounds(true);
                this.physics.add.collider(this.player, this.platforms);
            } catch (e) {
                console.log('Could not create player:', e);
            }
        }
    } catch (error) {
        console.error('Error in create function:', error);
    }
}

function update() {
    try {
        // Only handle player movement if player exists
        if (this.player && this.input) {
            const cursors = this.input.keyboard.createCursorKeys();
            if (cursors.left.isDown) {
                this.player.setVelocityX(-160);
            } else if (cursors.right.isDown) {
                this.player.setVelocityX(160);
            } else {
                this.player.setVelocityX(0);
            }

            if (cursors.up.isDown && this.player.body.touching.down) {
                this.player.setVelocityY(-330);
            }
        }
    } catch (error) {
        // Silent error handling for update
    }
}

async function suggestChanges() {
    const code = inputEditor.getValue();
    const prompt = document.getElementById('prompt').value;

    if (!code || !prompt) {
        alert('Please provide both code and a prompt');
        return;
    }

    // Show loading indicator
    const aiLoader = document.getElementById('aiLoader');
    if (aiLoader) {
        aiLoader.classList.remove('hidden');
    }
    
    // Save current state before making changes
    addToHistory(code);

    try {
        // Process the code based on the prompt using AI
        const result = await processCodeWithAI(code, prompt);
        
        if (result) {
            // Update suggested code editor
            suggestedEditor.setValue(result.code);
            
            // Generate visual diff - ensure both values are passed and force generation
            console.log('Generating diff...');
            setTimeout(() => generateDiff(code, result.code), 100);
            
            // Calculate performance metrics
            calculatePerformanceMetrics(result.performanceImpact);
            
            // Update explanation
            document.getElementById('explanation').innerHTML = `
                <h3 class="font-bold text-red-500">AI Suggested Improvements:</h3>
                <p class="mt-2">${result.explanation}</p>
                ${result.docLink ? `<a href="${result.docLink}" target="_blank" class="text-blue-400 hover:text-blue-300 mt-2 inline-block">
                    Learn more in Phaser.js documentation
                </a>` : ''}
                
                <div class="mt-4">
                    <h4 class="font-bold text-red-400">Additional Pattern Analysis:</h4>
                    <ul class="list-disc pl-5 mt-2">
                        ${detectCodePatterns(result.code)}
                    </ul>
                </div>
            `;

            // Update Learning Assistant with the current change
            // Find a matching lesson or use a generic one
            let matchedLessonIndex = 0;
            const promptLower = prompt.toLowerCase();
            
            for (let i = 0; i < learningLessons.length; i++) {
                if (learningLessons[i].title.toLowerCase().includes(promptLower) || 
                    promptLower.includes(learningLessons[i].title.toLowerCase())) {
                    matchedLessonIndex = i;
                    break;
                }
            }
            
            currentLessonIndex = matchedLessonIndex;
            displayLesson(currentLessonIndex);
        } else {
            // Handle AI failure
            document.getElementById('explanation').innerHTML = `
                <h3 class="font-bold text-red-500">AI Processing Failed</h3>
                <p class="mt-2">We couldn't generate a suggestion for your prompt. Please try again with a different prompt or check the console for errors.</p>
                
                <div class="mt-4">
                    <h4 class="font-bold text-red-400">Code Pattern Analysis:</h4>
                    <ul class="list-disc pl-5 mt-2">
                        ${detectCodePatterns(code)}
                    </ul>
                </div>
            `;
            
            // Clear the visual diff when no changes are made
            const diffOutput = document.getElementById('diffOutput');
            if (diffOutput) {
                diffOutput.innerHTML = '<div class="text-gray-500 text-center">No changes to display</div>';
            }
        }
    } catch (error) {
        console.error('Error processing with AI:', error);
        document.getElementById('explanation').innerHTML = `
            <h3 class="font-bold text-red-500">Error</h3>
            <p class="mt-2">An error occurred while processing your request: ${error.message}</p>
            <p class="mt-2">Using the fallback rule-based system instead.</p>
        `;
        
        // Try fallback to rule-based system
        const fallbackResult = processWithRules(code, prompt);
        if (fallbackResult) {
            suggestedEditor.setValue(fallbackResult.code);
            generateDiff(code, fallbackResult.code);
            calculatePerformanceMetrics(fallbackResult.performanceImpact);
        }
    } finally {
        // Hide loading indicator
        if (aiLoader) {
            aiLoader.classList.add('hidden');
        }
    }
}

function calculatePerformanceMetrics(impact) {
    if (!impact) return;
    
    // Store the metrics
    performanceMetrics = impact;
    
    // Update the metrics display
    const metricsContent = document.getElementById('metricsContent');
    if (!metricsContent) return;
    
    metricsContent.innerHTML = `
        <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="text-xl font-bold ${impact.cpu < 0 ? 'text-green-400' : 'text-red-400'}">${impact.cpu}%</div>
            <div class="text-sm text-gray-300">CPU Usage</div>
        </div>
        <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="text-xl font-bold ${impact.memory < 0 ? 'text-green-400' : 'text-red-400'}">${impact.memory}%</div>
            <div class="text-sm text-gray-300">Memory Usage</div>
        </div>
        <div class="bg-gray-700 p-4 rounded-lg text-center">
            <div class="text-xl font-bold ${impact.fps > 0 ? 'text-green-400' : 'text-red-400'}">${impact.fps > 0 ? '+' : ''}${impact.fps}</div>
            <div class="text-sm text-gray-300">FPS Impact</div>
        </div>
    `;
    
    // Update chart
    updatePerformanceChart(impact);
}

function updatePerformanceChart(impact) {
    if (!performanceChart) {
        console.error('Performance chart not initialized');
        return;
    }
    
    try {
        performanceChart.data.datasets[0].data = [impact.cpu, impact.memory, impact.fps];
        
        // Set colors based on whether each metric is good or bad
        performanceChart.data.datasets[0].backgroundColor = [
            impact.cpu < 0 ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 99, 132, 0.2)',
            impact.memory < 0 ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 99, 132, 0.2)',
            impact.fps > 0 ? 'rgba(75, 192, 192, 0.2)' : 'rgba(255, 99, 132, 0.2)'
        ];
        
        performanceChart.data.datasets[0].borderColor = [
            impact.cpu < 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)',
            impact.memory < 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)',
            impact.fps > 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'
        ];
        
        performanceChart.update();
    } catch (error) {
        console.error('Error updating performance chart:', error);
    }
}

function detectCodePatterns(code) {
    let patternResults = '';
    
    for (const [key, pattern] of Object.entries(phaserPatterns)) {
        if (pattern.pattern.test(code)) {
            // For patterns that need a counter check
            if (pattern.counterPattern && pattern.counterPattern.test(code)) {
                continue;
            }
            
            const priorityClass = pattern.priority === 'high' ? 'text-red-400' : 'text-yellow-400';
            patternResults += `<li><span class="font-bold ${priorityClass}">[${pattern.priority}]</span> ${pattern.suggestion}</li>`;
        }
    }
    
    return patternResults || '<li>No issues detected in the current code.</li>';
}

// Function to process code with Hugging Face AI models
async function processCodeWithAI(code, prompt) {
    // Check if HF client is initialized
    if (!hfInference) {
        // Try to initialize one more time
        const initialized = initializeHuggingFace();
        if (!initialized) {
            throw new Error("Hugging Face client not initialized. Check your network connection or try adding an API key.");
        }
    }
    
    try {
        // Get selected model and temperature
        const modelSelect = document.getElementById('aiModelSelect');
        const temperatureSlider = document.getElementById('temperatureSlider');
        
        const selectedModel = modelSelect ? modelSelect.value : aiModelConfig.defaultModel;
        const temperature = temperatureSlider ? parseFloat(temperatureSlider.value) : aiModelConfig.temperature;
        
        console.log(`Using model: ${selectedModel}, temperature: ${temperature}`);
        
        // Determine which prompt template to use based on the user prompt
        let promptTemplate = promptTemplates.general;
        if (prompt.toLowerCase().includes('optimize') || prompt.toLowerCase().includes('performance')) {
            promptTemplate = promptTemplates.optimize;
        } else if (prompt.toLowerCase().includes('add') || prompt.toLowerCase().includes('implement')) {
            promptTemplate = promptTemplates.addFeature;
        }
        
        // Format the prompt with the code and user request
        const formattedPrompt = promptTemplate
            .replace('{code}', code)
            .replace('{prompt}', prompt);
        
        console.log('Sending prompt to Hugging Face');
        
        // Send request to Hugging Face
        const response = await hfInference.textGeneration({
            model: selectedModel,
            inputs: formattedPrompt,
            parameters: {
                temperature: temperature,
                max_new_tokens: aiModelConfig.models[selectedModel]?.maxLength || aiModelConfig.maxLength,
                return_full_text: false
            }
        });
        
        console.log('Received response from Hugging Face');
        
        // Process the response
        if (response && response.generated_text) {
            // Extract the code from the response (assuming it's wrapped in ```javascript ... ``` blocks)
            let extractedCode = response.generated_text;
            
            // Try to extract code from markdown code blocks if present
            const codeBlockMatch = extractedCode.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
            if (codeBlockMatch && codeBlockMatch[1]) {
                extractedCode = codeBlockMatch[1].trim();
            }
            
            // Generate an explanation from the response
            let explanation = "AI improved the code based on your request.";
            
            // Try to extract explanation from the response
            const explanationMatch = response.generated_text.match(/explanation:([\s\S]*?)(?:```|$)/i);
            if (explanationMatch && explanationMatch[1]) {
                explanation = explanationMatch[1].trim();
            }
            
            // Extract any links to documentation if present
            let docLink = null;
            const docLinkMatch = response.generated_text.match(/https:\/\/phaser\.io\/docs[^\s)]+/);
            if (docLinkMatch) {
                docLink = docLinkMatch[0];
            }
            
            // Estimate performance impact based on changes
            const performanceImpact = estimatePerformanceImpact(code, extractedCode, response.generated_text);
            
            return {
                code: extractedCode,
                explanation: explanation,
                docLink: docLink,
                performanceImpact: performanceImpact,
                fullResponse: response.generated_text
            };
        } else {
            console.error('Empty or invalid response from Hugging Face');
            throw new Error('Empty or invalid response from AI service');
        }
    } catch (error) {
        console.error('Error calling Hugging Face API:', error);
        throw error;
    }
}

// Fallback function for rule-based processing
function processWithRules(code, prompt) {
    const promptLower = prompt.toLowerCase();
    // Find matching rule
    const rule = Object.entries(aiRules).find(([key]) => promptLower.includes(key));
    
    if (rule) {
        const [_, { pattern, replacement, explanation, docLink, performanceImpact }] = rule;
        let newCode = code;
        
        // Check if pattern is global
        if (pattern.global) {
            newCode = code.replace(pattern, replacement);
        } else {
            // For non-global patterns, just replace the first occurrence
            newCode = code.replace(pattern, replacement);
        }
        
        if (newCode !== code) {
            return {
                code: newCode,
                explanation,
                docLink,
                performanceImpact
            };
        }
    }
    
    return null;
}

// Add a simple line-by-line diff function that doesn't rely on external libraries
function simpleDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    let diffHtml = '';
    
    // Find the maximum number of lines
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
        const oldLine = i < oldLines.length ? oldLines[i] : '';
        const newLine = i < newLines.length ? newLines[i] : '';
        
        // Format the line content safely
        const formatLine = (line) => {
            return line
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/ /g, '&nbsp;');
        };
        
        if (oldLine !== newLine) {
            if (oldLine) {
                diffHtml += `<div style="background-color: #ffdddd; color: #660000; padding: 2px;">- ${formatLine(oldLine)}</div>`;
            }
            if (newLine) {
                diffHtml += `<div style="background-color: #ddffdd; color: #006600; padding: 2px;">+ ${formatLine(newLine)}</div>`;
            }
        } else {
            diffHtml += `<div style="padding: 2px; color: #444;">&nbsp; ${formatLine(oldLine)}</div>`;
        }
    }
    
    return diffHtml;
}

function generateDiff(originalCode, newCode) {
    try {
        if (!originalCode && !newCode) {
            console.error('Both original and new code are empty');
            return;
        }
        
        // Set defaults for empty input
        originalCode = originalCode || '';
        newCode = newCode || '';
        
        const diffOutput = document.getElementById('diffOutput');
        if (!diffOutput) {
            console.error('Diff output element not found');
            return;
        }
        
        // Use our simple diff function
        diffOutput.innerHTML = simpleDiff(originalCode, newCode);
        console.log('Diff generated using simple diff');
        
    } catch (error) {
        console.error('Error generating diff:', error);
        
        // Show error in diff panel
        const diffOutput = document.getElementById('diffOutput');
        if (diffOutput) {
            diffOutput.innerHTML = `<div style="color: red;">Error generating diff: ${error.message}</div>`;
        }
    }
}

function toggleDiffView() {
    diffViewMode = diffViewMode === 'split' ? 'unified' : 'split';
    console.log('Toggling diff view mode to:', diffViewMode);
    
    // Re-generate diff with new mode
    generateDiff(inputEditor.getValue(), suggestedEditor.getValue());
    
    // Update button text
    const toggleButton = document.getElementById('toggleDiffBtn');
    if (toggleButton) {
        toggleButton.textContent = `View ${diffViewMode === 'split' ? 'Unified' : 'Split'} Diff`;
    }
}

function executeSandboxCode() {
    const code = suggestedEditor.getValue() || inputEditor.getValue();
    const sandboxOutput = document.getElementById('sandboxOutput');
    const sandboxStatus = document.getElementById('sandboxStatus');
    
    if (!sandboxOutput || !sandboxStatus) {
        console.error('Sandbox elements not found');
        return;
    }
    
    // Clear previous output
    sandboxOutput.innerHTML = '';
    sandboxStatus.textContent = 'Executing...';
    
    try {
        // Create a safe execution context
        const sandbox = {
            console: {
                log: function(message) {
                    const logLine = document.createElement('div');
                    logLine.className = 'text-green-400';
                    logLine.textContent = '> ' + message;
                    sandboxOutput.appendChild(logLine);
                },
                error: function(message) {
                    const logLine = document.createElement('div');
                    logLine.className = 'text-red-400';
                    logLine.textContent = '> Error: ' + message;
                    sandboxOutput.appendChild(logLine);
                }
            },
            Phaser: window.Phaser
        };
        
        // Execute code in sandbox
        const scriptToExecute = `
            try {
                ${code}
                console.log('Code executed successfully!');
                
                // Performance testing
                const startTime = performance.now();
                for (let i = 0; i < 1000; i++) {
                    // Run some operations from the code
                }
                const endTime = performance.now();
                console.log('Execution time: ' + (endTime - startTime).toFixed(2) + 'ms');
            } catch (error) {
                console.error(error.message);
            }
        `;
        
        // Use Function constructor to create a sandbox
        const sandboxFunc = new Function(...Object.keys(sandbox), scriptToExecute);
        sandboxFunc(...Object.values(sandbox));
        
        sandboxStatus.textContent = 'Execution complete';
        sandboxStatus.className = 'text-green-400';
    } catch (error) {
        const errorLine = document.createElement('div');
        errorLine.className = 'text-red-400';
        errorLine.textContent = '> Error: ' + error.message;
        sandboxOutput.appendChild(errorLine);
        
        sandboxStatus.textContent = 'Execution failed';
        sandboxStatus.className = 'text-red-400';
    }
}

function integrateCode() {
    const suggestedCode = suggestedEditor.getValue();
    if (!suggestedCode) {
        alert('No suggested code to integrate');
        return;
    }

    // Save current state before integrating
    addToHistory(inputEditor.getValue());

    // Update input code
    inputEditor.setValue(suggestedCode);
    
    // Update output code
    outputEditor.setValue(suggestedCode);
    
    // Update game preview
    updateGamePreview(suggestedCode);
}

function updateGamePreview(code) {
    try {
        // Clear existing game
        if (game) {
            game.destroy(true);
        }
        
        // Reinitialize game with new code
        initializeGame();
    } catch (error) {
        console.error('Error updating game preview:', error);
    }
}

function addToHistory(code) {
    // Remove any future history if we're not at the end
    if (currentHistoryIndex < history.length - 1) {
        history = history.slice(0, currentHistoryIndex + 1);
    }
    
    // Only add to history if the code is different from the last entry
    if (history.length === 0 || history[history.length - 1] !== code) {
        history.push(code);
        currentHistoryIndex = history.length - 1;
        console.log('History updated:', history.length, 'entries, current index:', currentHistoryIndex);
    }
}

function undoChange() {
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        const previousCode = history[currentHistoryIndex];
        inputEditor.setValue(previousCode);
        console.log('Undo to index:', currentHistoryIndex);
    }
}

function redoChange() {
    if (currentHistoryIndex < history.length - 1) {
        currentHistoryIndex++;
        const nextCode = history[currentHistoryIndex];
        inputEditor.setValue(nextCode);
        console.log('Redo to index:', currentHistoryIndex);
    }
}

// Function to initialize AI model settings
function initializeAIModelSettings() {
    const modelSelect = document.getElementById('aiModelSelect');
    const temperatureSlider = document.getElementById('temperatureSlider');
    const temperatureValue = document.getElementById('temperatureValue');
    const aiModelBadge = document.getElementById('aiModelBadge');
    
    // Add API key input field and button
    const aiSettingsContainer = document.querySelector('.bg-gray-800.rounded-lg.p-6.shadow-lg:has(#aiModelSelect)');
    if (aiSettingsContainer && !document.getElementById('hfApiKeyInput')) {
        const apiKeyHtml = `
            <div class="mb-4">
                <label class="block text-gray-300 mb-2">Hugging Face API Key (optional):</label>
                <div class="flex">
                    <input type="password" id="hfApiKeyInput" placeholder="Enter your API key" 
                        class="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-l-lg text-white">
                    <button id="hfApiKeyBtn" class="bg-blue-500 hover:bg-blue-600 px-4 rounded-r-lg">Apply</button>
                </div>
                <p class="text-xs text-gray-400 mt-1">For higher rate limits and model access</p>
            </div>
        `;
        
        // Insert the HTML at the beginning of the container
        aiSettingsContainer.insertAdjacentHTML('afterbegin', apiKeyHtml);
        
        // Add event listener for the API key button
        document.getElementById('hfApiKeyBtn').addEventListener('click', () => {
            const apiKey = document.getElementById('hfApiKeyInput').value.trim();
            if (apiKey) {
                initializeHuggingFace(apiKey);
                alert('API key applied successfully!');
            } else {
                alert('Please enter a valid API key.');
            }
        });
    }
    
    if (modelSelect) {
        modelSelect.addEventListener('change', () => {
            const selectedModel = modelSelect.value;
            const modelConfig = aiModelConfig.models[selectedModel];
            
            // Update temperature based on selected model's default
            if (modelConfig && temperatureSlider) {
                temperatureSlider.value = modelConfig.temperature;
                if (temperatureValue) {
                    temperatureValue.textContent = modelConfig.temperature;
                }
            }
            
            // Update badge with selected model name
            if (aiModelBadge) {
                const modelName = selectedModel.split('/').pop();
                aiModelBadge.textContent = modelName;
            }
            
            console.log(`Model changed to: ${selectedModel}`);
        });
    }
    
    if (temperatureSlider && temperatureValue) {
        temperatureSlider.addEventListener('input', () => {
            temperatureValue.textContent = temperatureSlider.value;
        });
    }
    
    // Check if HF is initialized
    if (!hfInference) {
        console.error("Hugging Face client failed to initialize");
        if (aiModelBadge) {
            aiModelBadge.textContent = "AI Unavailable";
            aiModelBadge.classList.remove('bg-green-600');
            aiModelBadge.classList.add('bg-red-600');
        }
    }
}

// Function to initialize the Learning Assistant
function initializeLearningAssistant() {
    displayLesson(currentLessonIndex);
    
    // Set up navigation buttons
    const prevLessonBtn = document.getElementById('prevLessonBtn');
    const nextLessonBtn = document.getElementById('nextLessonBtn');
    
    if (prevLessonBtn && nextLessonBtn) {
        prevLessonBtn.addEventListener('click', () => {
            if (currentLessonIndex > 0) {
                currentLessonIndex--;
                displayLesson(currentLessonIndex);
            }
        });
        
        nextLessonBtn.addEventListener('click', () => {
            if (currentLessonIndex < learningLessons.length - 1) {
                currentLessonIndex++;
                displayLesson(currentLessonIndex);
            }
        });
    }
    
    // Add a button to view complex demo game
    const learningAssistant = document.getElementById('learningAssistant');
    if (learningAssistant) {
        const demoButton = document.createElement('button');
        demoButton.id = 'viewDemoBtn';
        demoButton.className = 'mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200 w-full';
        demoButton.textContent = 'View Complex Demo Game';
        demoButton.addEventListener('click', showDemoGame);
        
        learningAssistant.appendChild(demoButton);
    }
}

// Function to display a specific lesson
function displayLesson(index) {
    if (index < 0 || index >= learningLessons.length) return;
    
    const lesson = learningLessons[index];
    const titleElement = document.getElementById('lessonTitle');
    const explanationElement = document.getElementById('lessonExplanation');
    const codeComparisonElement = document.getElementById('codeComparison');
    const docsLinksElement = document.getElementById('docsLinks');
    const practicesListElement = document.getElementById('practicesList');
    
    if (titleElement) titleElement.textContent = lesson.title;
    if (explanationElement) explanationElement.textContent = lesson.explanation;
    
    // Update code comparison
    if (codeComparisonElement) {
        codeComparisonElement.classList.remove('hidden');
        const beforeCode = codeComparisonElement.querySelector('div:first-child pre');
        const afterCode = codeComparisonElement.querySelector('div:last-child pre');
        
        if (beforeCode) beforeCode.textContent = lesson.beforeCode;
        if (afterCode) afterCode.textContent = lesson.afterCode;
    }
    
    // Update documentation links
    if (docsLinksElement) {
        docsLinksElement.innerHTML = '';
        lesson.docs.forEach(doc => {
            const link = document.createElement('a');
            link.href = doc.url;
            link.target = '_blank';
            link.className = 'text-blue-400 hover:text-blue-300 block';
            link.textContent = doc.text;
            docsLinksElement.appendChild(link);
        });
    }
    
    // Update best practices
    if (practicesListElement) {
        practicesListElement.innerHTML = '';
        lesson.practices.forEach(practice => {
            const item = document.createElement('li');
            item.textContent = practice;
            practicesListElement.appendChild(item);
        });
    }
    
    // Update button states
    const prevButton = document.getElementById('prevLessonBtn');
    const nextButton = document.getElementById('nextLessonBtn');
    
    if (prevButton) prevButton.disabled = index === 0;
    if (nextButton) nextButton.disabled = index === learningLessons.length - 1;
}

// Function to show the complex demo game
function showDemoGame() {
    // Create modal for demo game
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 overflow-auto';
    modal.id = 'demoGameModal';
    
    const content = document.createElement('div');
    content.className = 'bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-screen overflow-auto';
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute top-4 right-4 text-gray-300 hover:text-white text-2xl';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Add content
    content.innerHTML = `
        <h2 class="text-2xl font-bold text-red-500 mb-4">${demoGame.config.title}</h2>
        <p class="text-gray-300 mb-6">${demoGame.config.description}</p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
                <h3 class="text-xl font-semibold text-yellow-400 mb-4">Optimization Techniques</h3>
                <ul class="list-disc pl-5 text-gray-300">
                    ${demoGame.config.optimizationScenarios.map(scenario => `<li>${scenario}</li>`).join('')}
                </ul>
            </div>
            <div>
                <h3 class="text-xl font-semibold text-yellow-400 mb-4">Performance Comparison</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-gray-700 p-4 rounded-lg">
                        <h4 class="font-bold text-red-400 mb-2">Before Optimization</h4>
                        <p class="text-gray-300">FPS: <span class="text-white font-bold">${demoGame.config.beforeMetrics.fps}</span></p>
                        <p class="text-gray-300">Draw Calls: <span class="text-white font-bold">${demoGame.config.beforeMetrics.drawCalls}</span></p>
                        <p class="text-gray-300">Memory Usage: <span class="text-white font-bold">${demoGame.config.beforeMetrics.memory}</span></p>
                        <p class="text-gray-300">Load Time: <span class="text-white font-bold">${demoGame.config.beforeMetrics.loadTime}</span></p>
                    </div>
                    <div class="bg-gray-700 p-4 rounded-lg">
                        <h4 class="font-bold text-green-400 mb-2">After Optimization</h4>
                        <p class="text-gray-300">FPS: <span class="text-white font-bold">${demoGame.config.afterMetrics.fps}</span></p>
                        <p class="text-gray-300">Draw Calls: <span class="text-white font-bold">${demoGame.config.afterMetrics.drawCalls}</span></p>
                        <p class="text-gray-300">Memory Usage: <span class="text-white font-bold">${demoGame.config.afterMetrics.memory}</span></p>
                        <p class="text-gray-300">Load Time: <span class="text-white font-bold">${demoGame.config.afterMetrics.loadTime}</span></p>
                    </div>
                </div>
                
                <div class="mt-6">
                    <canvas id="demoPerformanceChart" width="400" height="200"></canvas>
                </div>
            </div>
        </div>
        
        <h3 class="text-xl font-semibold text-yellow-400 mb-4">Optimized Game Code</h3>
        <div class="bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
            <pre class="text-gray-300 text-sm">${demoGame.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </div>
        
        <div class="mt-6 text-center">
            <button id="loadDemoInEditor" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200">
                Load Demo In Editor
            </button>
        </div>
    `;
    
    modal.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Initialize performance comparison chart
    setTimeout(() => {
        const ctx = document.getElementById('demoPerformanceChart');
        if (ctx) {
            new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['FPS', 'Draw Calls', 'Memory (MB)', 'Load Time (s)'],
                    datasets: [
                        {
                            label: 'Before Optimization',
                            data: [
                                demoGame.config.beforeMetrics.fps,
                                demoGame.config.beforeMetrics.drawCalls,
                                parseInt(demoGame.config.beforeMetrics.memory),
                                parseFloat(demoGame.config.beforeMetrics.loadTime)
                            ],
                            backgroundColor: 'rgba(255, 99, 132, 0.5)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'After Optimization',
                            data: [
                                demoGame.config.afterMetrics.fps,
                                demoGame.config.afterMetrics.drawCalls,
                                parseInt(demoGame.config.afterMetrics.memory),
                                parseFloat(demoGame.config.afterMetrics.loadTime)
                            ],
                            backgroundColor: 'rgba(75, 192, 192, 0.5)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // Add event listener for loading demo in editor
        document.getElementById('loadDemoInEditor').addEventListener('click', () => {
            inputEditor.setValue(demoGame.code);
            document.body.removeChild(modal);
        });
    }, 100);
}
