Payload Models
==============

Payload model shapes referenced by generated OpenWS role messages.

Client Role Payloads
--------------------

JoinedRoomPayload
~~~~~~~~~~~~~~~~~

Message: ``joinedRoom``

Role: :doc:`Client <roles/client>`

Accepted from: ``server``

Source: ``chat/core/src/models/client/joined-room-payload.ts``

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

ReceivedMessagePayload
~~~~~~~~~~~~~~~~~~~~~~

Message: ``receivedMessage``

Role: :doc:`Client <roles/client>`

Accepted from: ``server``

Source: ``chat/core/src/models/client/received-message-payload.ts``

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

Portal Role Payloads
--------------------

ReceivedRoomStatsPayload
~~~~~~~~~~~~~~~~~~~~~~~~

Message: ``receivedRoomStats``

Role: :doc:`Portal <roles/portal>`

Accepted from: ``server``

Source: ``chat/core/src/models/portal/received-room-stats-payload.ts``

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

Server Role Payloads
--------------------

CreateRoomPayload
~~~~~~~~~~~~~~~~~

Message: ``createRoom``

Role: :doc:`Server <roles/server>`

Accepted from: ``client``

Source: ``chat/core/src/models/server/create-room-payload.ts``

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

JoinRoomPayload
~~~~~~~~~~~~~~~

Message: ``joinRoom``

Role: :doc:`Server <roles/server>`

Accepted from: ``client``

Source: ``chat/core/src/models/server/join-room-payload.ts``

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

RequestRoomStatsPayload
~~~~~~~~~~~~~~~~~~~~~~~

Message: ``requestRoomStats``

Role: :doc:`Server <roles/server>`

Accepted from: ``portal``

Source: ``chat/core/src/models/server/request-room-stats-payload.ts``

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

SendMessagePayload
~~~~~~~~~~~~~~~~~~

Message: ``sendMessage``

Role: :doc:`Server <roles/server>`

Accepted from: ``client``, ``portal``

Source: ``chat/core/src/models/server/send-message-payload.ts``

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

