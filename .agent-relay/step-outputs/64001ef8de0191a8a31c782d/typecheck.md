src/chat-session.ts(107,24): error TS2339: Property 'inject' does not exist on type 'AgentRelay'.
src/chat-session.ts(145,10): error TS2339: Property 'inject' does not exist on type 'AgentRelay'.
src/chat-session.ts(169,22): error TS2339: Property 'release' does not exist on type 'AgentRelay'.
src/chat-session.ts(181,20): error TS2339: Property 'release' does not exist on type 'AgentRelay'.
src/chat-session.ts(190,34): error TS2345: Argument of type 'string' is not assignable to parameter of type '{ agent: string; channels: string[]; }'.
src/chat-session.ts(202,39): error TS2345: Argument of type '{ command: string; args: string[]; env: Record<string, string> | undefined; task: string; channel: string; }' is not assignable to parameter of type 'string'.
src/mock-trajectories.ts(11,8): error TS2307: Cannot find module 'agent-trajectories' or its corresponding type declarations.
src/preview-generator.ts(9,8): error TS6059: File '/Users/khaliqgant/Projects/AgentWorkforce/trajectories/src/core/types.ts' is not under 'rootDir' '/Users/khaliqgant/Projects/AgentWorkforce/trajectories/trail-viewer/server/src'. 'rootDir' is expected to contain all source files.
src/relay-bridge.ts(1,44): error TS7016: Could not find a declaration file for module 'ws'. '/Users/khaliqgant/Projects/AgentWorkforce/trajectories/node_modules/ws/wrapper.mjs' implicitly has an 'any' type.
  Try `npm i --save-dev @types/ws` if it exists or add a new declaration (.d.ts) file containing `declare module 'ws';`
src/relay-bridge.ts(135,13): error TS2322: Type '{ id: string; name: string; emoji: string; description: string; color: string; }[]' is not assignable to type 'string[]'.
  Type '{ id: string; name: string; emoji: string; description: string; color: string; }' is not assignable to type 'string'.
src/relay-bridge.ts(153,21): error TS2339: Property 'text' does not exist on type 'SendMessagePayload'.
src/server.ts(1,23): error TS2307: Cannot find module '@hono/node-server' or its corresponding type declarations.
src/test-chat.ts(1,23): error TS7016: Could not find a declaration file for module 'ws'. '/Users/khaliqgant/Projects/AgentWorkforce/trajectories/node_modules/ws/wrapper.mjs' implicitly has an 'any' type.
  Try `npm i --save-dev @types/ws` if it exists or add a new declaration (.d.ts) file containing `declare module 'ws';`
src/test-chat.ts(67,26): error TS7006: Parameter 'err' implicitly has an 'any' type.
src/trajectory-formatter.ts(9,8): error TS2307: Cannot find module 'agent-trajectories/sdk' or its corresponding type declarations.
src/trajectory-service.ts(6,8): error TS2307: Cannot find module 'agent-trajectories' or its corresponding type declarations.
src/trajectory-service.ts(7,34): error TS2307: Cannot find module 'agent-trajectories/sdk' or its corresponding type declarations.
