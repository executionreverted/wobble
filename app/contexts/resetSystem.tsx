// Create a new file: app/utils/resetSystem.ts

import { createContext, useContext } from 'react';

// Interface for resettable contexts
export interface Resettable {
  reset: () => void;
}

// Registry to keep track of all resettable contexts
class ResetRegistry {
  private contexts: Map<string, Resettable> = new Map();

  // Register a context with the registry
  register(name: string, context: Resettable): void {
    this.contexts.set(name, context);
  }

  // Unregister a context
  unregister(name: string): void {
    this.contexts.delete(name);
  }

  // Reset all registered contexts in the correct order
  resetAll(): void {
    // Define the order of context resets - modify based on your hierarchy
    const resetOrder = [
      'UserContext',   // User should be reset first
      'ChatContext',   // Then chat-related contexts
      'WorkletContext' // Backend connection last
    ];

    // Reset contexts in the defined order
    resetOrder.forEach(contextName => {
      const context = this.contexts.get(contextName);
      if (context) {
        context.reset();
      }
    });

    // Reset any remaining contexts not explicitly ordered
    this.contexts.forEach((context, name) => {
      if (!resetOrder.includes(name)) {
        context.reset();
      }
    });

    console.log('All contexts reset successfully');
  }
}

// Create a single registry instance
export const resetRegistry = new ResetRegistry();

// Context for the reset system
export const ResetContext = createContext<{
  resetAllContexts: () => void;
}>({
  resetAllContexts: () => { }
});

// Hook for using the reset system
export const useResetSystem = () => useContext(ResetContext);

export default resetRegistry;
