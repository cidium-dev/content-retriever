import type { Page } from '@playwright/test';

/**
 * Attempts to bypass Cloudflare protection by handling 
 * common challenge scenarios
 */
export async function handleCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    // Check for Cloudflare challenge elements
    const challengeSelectors = [
      '#cf-spinner',
      '.cf-browser-verification',
      '#challenge-form',
      '.ray-id',
      'iframe[src*="challenges.cloudflare.com"]',
      'div[class*="cloudflare"]'
    ];
    
    const hasCloudflarePage = await page.$(challengeSelectors.join(', ')).then(Boolean);
    
    if (!hasCloudflarePage) {
      return false; // No challenge detected
    }
    
    console.log('Cloudflare challenge detected, attempting to solve...');
    
    // Emulate human-like behavior
    await emulateHumanBehavior(page);
    
    // Try to find and interact with verification elements
    await interactWithChallengeElements(page);
    
    // Wait for challenge to be solved
    await page.waitForTimeout(10000);
    
    // Check if we still have challenge page
    const stillHasChallenge = await page.$(challengeSelectors.join(', ')).then(Boolean);
    
    return !stillHasChallenge;
  } catch (error) {
    console.error('Error handling Cloudflare challenge:', error);
    return false;
  }
}

/**
 * Emulates human-like behavior on the page
 */
async function emulateHumanBehavior(page: Page): Promise<void> {
  // Random mouse movements
  const viewportSize = await page.viewportSize();
  if (!viewportSize) return;
  
  const { width, height } = viewportSize;
  
  // Move mouse to random positions with human-like steps
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    await page.mouse.move(x, y, { steps: 5 });
    await page.waitForTimeout(Math.random() * 500 + 200);
  }
  
  // Scroll down and up slowly
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1000);
  await page.mouse.wheel(0, -150);
  await page.waitForTimeout(500);
  
  // Add some random waits
  await page.waitForTimeout(Math.random() * 2000 + 1000);
}

/**
 * Attempts to interact with common Cloudflare challenge elements
 */
async function interactWithChallengeElements(page: Page): Promise<void> {
  // Look for common buttons and checkboxes in Cloudflare challenges
  const interactiveElements = [
    // Verify you're human buttons
    'button:has-text("Verify")',
    'button:has-text("Continue")',
    'button:has-text("I am human")',
    'input[type="button"][value*="Verify"]',
    'input[type="submit"][value*="Continue"]',
    
    // Checkbox challenges
    'input[type="checkbox"]#cf-turnstile-response',
    'input[type="checkbox"].recaptcha-checkbox',
    '.recaptcha-checkbox-border',
    
    // General challenge form elements
    '#challenge-form button',
    '#challenge-form input[type="submit"]',
    
    // Turnstile elements
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[src*="turnstile"]'
  ];
  
  for (const selector of interactiveElements) {
    const element = await page.$(selector);
    if (element) {
      try {
        // Try to click the element
        await element.click();
        console.log(`Clicked element: ${selector}`);
        await page.waitForTimeout(2000);
        
        // Check if we need to handle iframes for captchas
        if (selector.includes('iframe')) {
          await handleCaptchaIframes(page);
        }
      } catch (error) {
        console.log(`Failed to interact with ${selector}:`, error);
      }
    }
  }
}

/**
 * Handles captcha iframes if present
 */
async function handleCaptchaIframes(page: Page): Promise<void> {
  const frames = page.frames();
  
  for (const frame of frames) {
    const url = frame.url();
    if (url.includes('challenges.cloudflare.com') || 
        url.includes('turnstile') || 
        url.includes('recaptcha')) {
      
      try {
        // Try to find and click checkbox in the frame
        const checkbox = await frame.$('input[type="checkbox"], .recaptcha-checkbox-border');
        if (checkbox) {
          await checkbox.click();
          console.log('Clicked captcha checkbox in iframe');
          await page.waitForTimeout(2000);
        }
        
        // Try to find and click verify button in the frame
        const verifyButton = await frame.$('button:has-text("Verify"), button:has-text("Submit")');
        if (verifyButton) {
          await verifyButton.click();
          console.log('Clicked verify button in iframe');
          await page.waitForTimeout(2000);
        }
      } catch (error) {
        console.log('Failed to interact with iframe elements:', error);
      }
    }
  }
}

/**
 * Rotates proxies or IPs to help bypass rate limits
 * Note: This is a placeholder - actual implementation would depend on
 * your proxy setup and infrastructure
 */
export async function rotateProxy(): Promise<string | null> {
  // This is where you would implement your proxy rotation logic
  // For example, connecting to a different proxy from a pool
  
  console.log('Rotating proxy (placeholder function)');
  
  // Return the new proxy address or null if rotation failed
  return null;
}