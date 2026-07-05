Server Role
===========

Generated role surface for server.

.. rst-class:: lead

Generated role surface for ``server`` in the ``core`` OpenWS network.

Role class: ``Server``

Source: ``chat/core/src/roles/server.ts``

Endpoints
---------

- ``ws://localhost:8082/chat``

Messages
--------

.. list-table::
   :header-rows: 1

   * - Message
     - Accepted from
     - Payload
     - Description
   * - ``createRoom``
     - ``client``
     - ``CreateRoomPayload``
     - n/a
   * - ``joinRoom``
     - ``client``
     - ``JoinRoomPayload``
     - n/a
   * - ``requestRoomStats``
     - ``portal``
     - ``RequestRoomStatsPayload``
     - n/a
   * - ``sendMessage``
     - ``client``, ``portal``
     - ``SendMessagePayload``
     - n/a


Create Room
-----------

n/a

Payload: ``CreateRoomPayload``

Payload source: ``chat/core/src/models/server/create-room-payload.ts``

Accepted from: ``client``

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - ``roomId``
     - ``string``
     - yes
     - n/a
   * - ``userId``
     - ``string``
     - yes
     - n/a

Join Room
---------

n/a

Payload: ``JoinRoomPayload``

Payload source: ``chat/core/src/models/server/join-room-payload.ts``

Accepted from: ``client``

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - ``roomId``
     - ``string``
     - yes
     - n/a
   * - ``userId``
     - ``string``
     - yes
     - n/a

Request Room Stats
------------------

n/a

Payload: ``RequestRoomStatsPayload``

Payload source: ``chat/core/src/models/server/request-room-stats-payload.ts``

Accepted from: ``portal``

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - ``roomId``
     - ``string``
     - yes
     - n/a

Send Message
------------

n/a

Payload: ``SendMessagePayload``

Payload source: ``chat/core/src/models/server/send-message-payload.ts``

Accepted from: ``client``, ``portal``

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - ``roomId``
     - ``string``
     - yes
     - n/a
   * - ``tags``
     - ``string[]``
     - no
     - n/a
   * - ``text``
     - ``string``
     - yes
     - n/a
   * - ``userId``
     - ``string``
     - yes
     - n/a

