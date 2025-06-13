Here's the fixed version with all missing closing brackets added:

```javascript
          </div>
        )}
      </div>
      
      {/* Point animation */}
      {showPointAnimation && (
        <PointAnimation 
          points={pointsEarned}
          onComplete={() => setShowPointAnimation(false)}
        />
      )}
    </div>
  );
}
```

The file was missing the closing brackets for the final `div` element, the point animation conditional render, and the function component. I've added all three closing brackets in the correct order to properly close all open elements and blocks.