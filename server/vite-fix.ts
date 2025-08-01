// This is a compatibility layer to fix the path-to-regexp issue with the * wildcard
import express from 'express';

export function applyViteFix() {
  const originalUse = express.application.use;
  
  express.application.use = function(path: any, ...args: any[]) {
    if (typeof path === 'string' && path === '*') {
      return originalUse.apply(this, [/.*/, ...args] as [any, any]);
    }
    
    return originalUse.apply(this, [path, ...args] as [any, any]);
  };
}