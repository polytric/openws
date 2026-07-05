Chat Core OpenWS SDK
====================

A chat network

.. rst-class:: lead

Use this reference to find the generated TypeScript surfaces for ``core``, including role classes, message payloads, source paths, and install/import snippets.

.. list-table::
   :header-rows: 1

   * - Network
     - Roles
     - Messages
     - Version
   * - :doc:`Core <core>`
     - 3
     - 7
     - ``1.0.0``

Install
-------

.. code-block:: shell

   pnpm add @example/chat-core-openws-sdk

Import Surface
--------------

.. code-block:: typescript

   import { CoreNetwork, roles, sdk } from '@example/chat-core-openws-sdk';

Role Surfaces
-------------

.. list-table::
   :header-rows: 1

   * - Role
     - Generated class
     - Messages
     - Endpoints
   * - :doc:`Client <roles/client>`
     - ``Client``
     - 2
     - none
   * - :doc:`Portal <roles/portal>`
     - ``Portal``
     - 1
     - none
   * - :doc:`Server <roles/server>`
     - ``Server``
     - 4
     - 1

.. toctree::
   :caption: API Reference
   :maxdepth: 2

   core
   roles/client
   roles/portal
   roles/server
   models
