Client Role
===========

Generated role surface for client.

.. rst-class:: lead

Generated role surface for ``client`` in the ``core`` OpenWS network.

Role class: ``Client``

Source: ``chat/core/src/roles/client.ts``

Messages
--------

.. list-table::
   :header-rows: 1

   * - Message
     - Accepted from
     - Payload
     - Description
   * - ``joinedRoom``
     - ``server``
     - ``JoinedRoomPayload``
     - n/a
   * - ``receivedMessage``
     - ``server``
     - ``ReceivedMessagePayload``
     - n/a


Joined Room
-----------

n/a

Payload: ``JoinedRoomPayload``

Payload source: ``chat/core/src/models/client/joined-room-payload.ts``

Accepted from: ``server``

.. list-table::
   :header-rows: 1

   * - Field
     - Type
     - Required
     - Description
   * - ``joinerId``
     - ``string``
     - yes
     - n/a
   * - ``roomId``
     - ``string``
     - yes
     - n/a

Received Message
----------------

n/a

Payload: ``ReceivedMessagePayload``

Payload source: ``chat/core/src/models/client/received-message-payload.ts``

Accepted from: ``server``

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
   * - ``senderId``
     - ``string``
     - yes
     - n/a
   * - ``text``
     - ``string``
     - yes
     - n/a

