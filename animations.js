/**
 * PhaseUp.AI - Game-themed Animations
 * Interactive animations for enhancing the user experience
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all animations
  initBackground();
  initParticles();
  initTechScanner();
  initGlowEffects();
  initTypingAnimations();
  initFloatingElements();
});

/**
 * Background pixel animations
 */
function initBackground() {
  // Create floating pixels in the background
  const pixelCount = Math.floor(window.innerWidth / 50);
  const container = document.querySelector('body');
  
  for (let i = 0; i < pixelCount; i++) {
    createPixel(container);
  }
  
  // Code rain effect
  createCodeRain();
}

function createPixel(container) {
  const pixel = document.createElement('div');
  pixel.classList.add('pixel');
  
  // Random properties
  const size = Math.random() * 5 + 2;
  const posX = Math.random() * window.innerWidth;
  const posY = Math.random() * window.innerHeight;
  const duration = Math.random() * 10 + 10;
  const delay = Math.random() * 5;
  
  // Set style
  pixel.style.width = `${size}px`;
  pixel.style.height = `${size}px`;
  pixel.style.left = `${posX}px`;
  pixel.style.top = `${posY}px`;
  pixel.style.opacity = (Math.random() * 0.1 + 0.05).toString();
  
  // Add animation
  pixel.style.animation = `float ${duration}s ease-in-out ${delay}s infinite`;
  
  container.appendChild(pixel);
}

function createCodeRain() {
  const container = document.querySelector('body');
  const columns = Math.floor(window.innerWidth / 20);
  
  for (let i = 0; i < columns; i++) {
    const codeRain = document.createElement('div');
    codeRain.classList.add('code-rain');
    
    const posX = i * 20;
    const posY = Math.random() * -1000;
    const speed = Math.random() * 2 + 1;
    
    codeRain.style.left = `${posX}px`;
    codeRain.style.top = `${posY}px`;
    
    // Generate random binary/code characters
    const characters = ['0', '1', '{', '}', '<', '>', '/', '*', '+', '-', '='];
    const length = Math.floor(Math.random() * 20) + 10;
    
    let text = '';
    for (let j = 0; j < length; j++) {
      text += characters[Math.floor(Math.random() * characters.length)];
    }
    
    codeRain.textContent = text;
    
    // Animate dropping
    codeRain.style.animation = `drop ${speed * 10}s linear infinite`;
    
    // Create keyframes for this element
    const keyframes = `
      @keyframes drop {
        0% { transform: translateY(0); }
        100% { transform: translateY(${window.innerHeight + 1000}px); }
      }
    `;
    
    const style = document.createElement('style');
    style.textContent = keyframes;
    document.head.appendChild(style);
    
    container.appendChild(codeRain);
  }
}

/**
 * Particle system for interactive elements
 */
function initParticles() {
  // Add click event to create particles
  document.addEventListener('click', (e) => {
    createParticles(e.clientX, e.clientY);
  });
  
  // Add particles to buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      createParticles(x, y);
    });
  });
}

function createParticles(x, y) {
  const container = document.querySelector('body');
  const particleCount = 15;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    
    // Random properties
    const size = Math.random() * 8 + 2;
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 4 + 2;
    const lifetime = Math.random() * 1000 + 500;
    
    // Set initial position
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    
    // Add to DOM
    container.appendChild(particle);
    
    // Animate the particle
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;
    
    let opacity = 1;
    let posX = x;
    let posY = y;
    
    const animate = () => {
      if (opacity <= 0) {
        container.removeChild(particle);
        return;
      }
      
      posX += dx;
      posY += dy;
      opacity -= 0.02;
      
      particle.style.left = `${posX}px`;
      particle.style.top = `${posY}px`;
      particle.style.opacity = opacity.toString();
      
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
    
    // Safety cleanup
    setTimeout(() => {
      if (particle.parentNode === container) {
        container.removeChild(particle);
      }
    }, lifetime);
  }
}

/**
 * Tech scanner effect
 */
function initTechScanner() {
  const scanner = document.createElement('div');
  scanner.classList.add('tech-scanner');
  document.body.appendChild(scanner);
}

/**
 * Glowing effects for important elements
 */
function initGlowEffects() {
  // Add glow effect class to important elements
  const importantElements = document.querySelectorAll('.btn-primary, .important-element, h1');
  
  importantElements.forEach(element => {
    element.classList.add('glow-effect');
  });
  
  // Add game button styling
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.classList.add('game-button');
  });
  
  // Add card hover effects
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.classList.add('card-hover');
  });
}

/**
 * Typing animation effect
 */
function initTypingAnimations() {
  const typingElements = document.querySelectorAll('.typing-animation');
  
  typingElements.forEach(element => {
    const text = element.textContent;
    element.textContent = '';
    element.classList.add('typing-text');
    
    let i = 0;
    const speed = 50; // ms per character
    
    function typeWriter() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(typeWriter, speed);
      }
    }
    
    typeWriter();
  });
}

/**
 * Floating animation for elements
 */
function initFloatingElements() {
  const floatingElements = document.querySelectorAll('.floating');
  
  floatingElements.forEach(element => {
    element.classList.add('float-animation');
  });
}

/**
 * Pulse animation for notification elements
 */
function pulseElement(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.classList.add('pulse-animation');
    
    // Remove class after animation completes
    setTimeout(() => {
      element.classList.remove('pulse-animation');
    }, 2000);
  }
}

/**
 * Add glitch effect to text
 */
function glitchText(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.classList.add('glitch-text');
    
    // Remove class after animation completes
    setTimeout(() => {
      element.classList.remove('glitch-text');
    }, 3000);
  }
}

/**
 * Progress bar animation
 */
function animateProgress(selector, duration = 2000) {
  const progressBar = document.querySelector(selector);
  if (progressBar) {
    progressBar.classList.add('progress-animation');
    progressBar.style.animationDuration = `${duration}ms`;
  }
}

/**
 * Add spotlight effect to element on hover
 */
function addSpotlight(selector) {
  const elements = document.querySelectorAll(selector);
  elements.forEach(element => {
    element.classList.add('spotlight');
  });
}

/**
 * Fade in elements as they come into view
 */
function initFadeInElements() {
  const fadeElements = document.querySelectorAll('.fade-element');
  
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  fadeElements.forEach(element => {
    fadeObserver.observe(element);
  });
}

/**
 * Fade up elements as they come into view
 */
function initFadeUpElements() {
  const fadeElements = document.querySelectorAll('.fade-up-element');
  
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in-up');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  fadeElements.forEach(element => {
    fadeObserver.observe(element);
  });
}

// Export functions to be used from other scripts
window.phaseUpAnimations = {
  pulseElement,
  glitchText,
  animateProgress,
  addSpotlight,
  createParticles,
  initFadeInElements,
  initFadeUpElements
}; 