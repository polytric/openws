const { validate, WS } = require('../dist/index')

const spec = WS.spec('0.0.1')
  .title('Chat Example')
  .description('A simple chat server with one client using WS.')
  .version('1.0.0')
  .network(WS.network('chat')
    .role(WS.role('server')
      .message(WS.message('message')
        .payload({
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        })
      )
    )
  )

validate(spec.toJson())
console.log('spec is valid')
