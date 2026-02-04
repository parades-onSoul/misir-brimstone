# Logging System

The Misir application uses [Pino](https://github.com/pinojs/pino) for fast, structured JSON logging.

## Usage

### Basic Logging

```typescript
import { logger } from '@/lib/logger';

logger.info('User action completed');
logger.warn('Rate limit approaching', { userId: '123', requests: 95 });
logger.error('Database query failed', { query: 'SELECT...', error: err });
logger.debug('Internal state', { stateVector: [10, 0, 0, 0] });
```

### Module-Specific Loggers

```typescript
import { authLogger, dbLogger, apiLogger } from '@/lib/logger';

authLogger.info('User signed in', { userId: '123', email: 'user@example.com' });
dbLogger.error('Connection pool exhausted', { activeConnections: 100 });
apiLogger.debug('Request received', { method: 'POST', path: '/api/intents' });
```

### Custom Child Loggers

```typescript
import { createLogger } from '@/lib/logger';

const intentLogger = createLogger('intents', { intentId: '550e8400' });
intentLogger.info('Artifact added');
intentLogger.debug('State transition', { from: 0, to: 1 });
```

### Error Logging Helper

```typescript
import { logError } from '@/lib/logger';

try {
  await riskyOperation();
} catch (error) {
  logError(error, { operation: 'riskyOperation', userId: '123' });
}
```

### Request Logging

```typescript
import { logRequest } from '@/lib/logger';

logRequest({
  method: 'POST',
  url: '/api/artifacts',
  userId: '123',
  duration: 45,
  statusCode: 201
});
```

## Log Levels

Pino uses the following log levels (in order of severity):

- **trace** (10): Very detailed diagnostic information
- **debug** (20): Detailed information for debugging
- **info** (30): General informational messages
- **warn** (40): Warning messages for potentially harmful situations
- **error** (50): Error messages for failures
- **fatal** (60): Critical errors causing application shutdown

## Configuration

### Environment Variables

- `LOG_LEVEL`: Set minimum log level (default: `debug` in development, `info` in production)
- `NODE_ENV`: Determines output format (pretty in development, JSON in production)

### Production Logging

In production, logs are output as structured JSON for easy parsing:

```json
{
  "level": 30,
  "time": "2025-12-17T10:30:00.000Z",
  "env": "production",
  "app": "misir",
  "module": "auth",
  "userId": "123",
  "msg": "User signed in"
}
```

### Development Logging

In development, logs are pretty-printed for readability:

```
[10:30:00] INFO (auth): User signed in
    userId: "123"
    email: "user@example.com"
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// ✅ Good
logger.debug('Processing intent state transition', { intentId });
logger.info('User created new intent', { userId, intentName });
logger.warn('Evidence decay threshold approaching', { evidence, threshold });
logger.error('Failed to save artifact', { error, artifactId });

// ❌ Bad
logger.info('x=5, y=10'); // Too verbose for info
logger.error('Something happened'); // Not descriptive enough
```

### 2. Include Context

```typescript
// ✅ Good
logger.error('Database query failed', {
  query: sql,
  error: err.message,
  userId,
  intentId
});

// ❌ Bad
logger.error('Query failed');
```

### 3. Use Module Loggers

```typescript
// ✅ Good
import { dbLogger } from '@/lib/logger';
dbLogger.info('Connection established');

// ❌ Bad (mixing concerns)
import { authLogger } from '@/lib/logger';
authLogger.info('Database connected'); // Wrong logger
```

### 4. Log Structured Data

```typescript
// ✅ Good
logger.info('State transition completed', {
  intentId: '550e8400',
  oldState: [10, 0, 0, 0],
  newState: [5, 5, 0, 0],
  evidence: 7.5
});

// ❌ Bad
logger.info(`State changed from [10,0,0,0] to [5,5,0,0]`); // String interpolation
```

### 5. Avoid Logging Sensitive Data

```typescript
// ✅ Good
logger.info('User authenticated', { userId: '123' });

// ❌ Bad
logger.info('User authenticated', { 
  userId: '123',
  password: 'secret123', // Never log passwords!
  apiKey: 'sk_live_...'  // Never log API keys!
});
```

## Example Integration

### API Route

```typescript
import { apiLogger, logRequest, logError } from '@/lib/logger';

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    apiLogger.debug('Processing artifact creation');
    
    const body = await request.json();
    const result = await createArtifact(body);
    
    logRequest({
      method: 'POST',
      url: '/api/artifacts',
      userId: body.userId,
      duration: Date.now() - startTime,
      statusCode: 201
    });
    
    return Response.json(result, { status: 201 });
  } catch (error) {
    logError(error, {
      method: 'POST',
      url: '/api/artifacts',
      duration: Date.now() - startTime
    });
    
    return Response.json({ error: 'Failed to create artifact' }, { status: 500 });
  }
}
```

### Engine Function

```typescript
import { engineLogger } from '@/lib/logger';

export function handleStateTransitions(
  state: StateVector,
  oldEvidence: number,
  newEvidence: number
): StateVector {
  engineLogger.debug('Evaluating state transition', {
    oldEvidence,
    newEvidence,
    currentState: state
  });
  
  const oldState = getStateFromEvidence(oldEvidence);
  const newState = getStateFromEvidence(newEvidence);
  
  if (oldState !== newState) {
    engineLogger.info('State transition triggered', {
      from: oldState,
      to: newState,
      evidenceDelta: newEvidence - oldEvidence
    });
  }
  
  // ... transition logic
  
  return result;
}
```

## Performance

Pino is one of the fastest Node.js loggers:
- Minimal overhead in production
- Asynchronous by default
- Efficient JSON serialization
- Optional sampling for high-throughput scenarios

## Log Aggregation

For production deployments, integrate with log aggregation services:

- **DataDog**: Use `pino-datadog` transport
- **CloudWatch**: Use `pino-cloudwatch` transport
- **Elasticsearch**: Use `pino-elasticsearch` transport
- **LogDNA**: Use `pino-logdna` transport

Example with DataDog:

```typescript
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-datadog',
    options: {
      apiKey: process.env.DATADOG_API_KEY,
      service: 'misir',
      hostname: process.env.HOSTNAME
    }
  }
});
```
