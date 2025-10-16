function submitToWebInterface(prompt) {
      // This is a simplified example - actual implementation would need
      // to adapt to each specific web interface
      try {
        // Generic web interface interaction
        if (iframe.contentWindow) {
          // Try to focus the iframe and simulate user input
          iframe.contentWindow.focus();

          // Keyboard simulation approach (works across most sites)
          const keydownEvent = new KeyboardEvent('keydown', {
            key: 'a',
            ctrlKey: true,
            bubbles: true
          });
          iframe.contentDocument.dispatchEvent(keydownEvent);

          const keyupEvent = new KeyboardEvent('keyup', {
            key: 'a',
            ctrlKey: true,
            bubbles: true
          });
          iframe.contentDocument.dispatchEvent(keyupEvent);

          // Wait a bit then try to paste the prompt
          setTimeout(() => {
            iframe.contentDocument.execCommand('insertText', false, prompt);

            // Now try to find and click send buttons
            setTimeout(() => {
              // Common selectors for send/submit buttons
              const buttonSelectors = [
                '[data-testid="send-button"]',
                '[data-testid="submit-button"]',
                'button[type="submit"]',
                'button:has-text("Send")',
                'button:has-text("Submit")',
                'button:has-text("Ask")',
                '.send-button',
                '.submit-button',
                'input[type="submit"]',
                'form button:last-of-type'
              ];

              let sendBtn = null;
              for (const selector of buttonSelectors) {
                if (selector.includes(':has-text')) {
                  const buttons = iframe.contentDocument.querySelectorAll('button');
                  for (const btn of buttons) {
                    if (btn.textContent.toLowerCase().includes(selector.split('"')[1].toLowerCase())) {
                      sendBtn = btn;
                      break;
                    }
                  }
                } else {
                  sendBtn = iframe.contentDocument.querySelector(selector);
                }
                if (sendBtn) break;
              }

              if (sendBtn) {
                sendBtn.click();
                // Success - the response monitoring will pick this up
              } else {
                vscode.postMessage({
                  command: 'error',
                  conversationId: currentConversationId,
                  error: { message: 'Could not find send button on web interface' }
                });
              }
            }, 1000);
          }, 500);
        }
      } catch (error) {
        console.error('Failed to submit to web interface:', error);
        vscode.postMessage({
          command: 'error',
          conversationId: currentConversationId,
          error: { message: 'Failed to interact with web interface: ' + error.message }
        });
      }
    }

    // More robust response monitoring
    let lastResponseCount = 0;
