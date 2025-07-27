// This is a compatibility layer to fix the path-to-regexp issue with the * wildcard
import express from 'express';

export function applyViteFix() {
  const originalUse = express.application.use;
  
  express.application.use = function(path: any, ...args: any[]) {
    // If the path is the problematic "*" pattern, convert it to a regex
    if (typeof path === 'string' && path === '*') {
      return originalUse.call(this, /.*/, ...args);
    }
    
    return originalUse.call(this, path, ...args);
  };
}