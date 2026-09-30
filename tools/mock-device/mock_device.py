"""
Mock of the teacher's BLE device, for testing the app before class.

Runs a GATT server on this Mac with the same service/characteristic UUIDs:
  - read  -> "Enter your name"  (until someone writes)
  - write -> stores the name
  - read  -> "<name> - Your grade is X."  (random grade, like the real device's demo)

Usage:
  python3 -m venv .venv && .venv/bin/pip install bless
  .venv/bin/python mock_device.py

macOS will ask for Bluetooth permission for your terminal / VS Code the first time.
"""

import asyncio
import random

from bless import (
    BlessGATTCharacteristic,
    BlessServer,
    GATTAttributePermissions,
    GATTCharacteristicProperties,
)

SERVICE_UUID = "aee04821-1973-4e1f-a590-e84b10d580e7"
CHAR_UUID = "cde07b1a-889b-44b7-a99f-c888dddac729"
DEVICE_NAME = "Mock Grade Device"

# Kept here rather than as the characteristic's initial value:
# CoreBluetooth only allows a fixed initial value on read-only characteristics.
current_value = bytearray(b"Enter your name")


def on_read(characteristic: BlessGATTCharacteristic, **kwargs) -> bytearray:
    print(f"READ  -> {current_value.decode('utf-8', 'replace')!r}")
    return current_value


def on_write(characteristic: BlessGATTCharacteristic, value, **kwargs):
    global current_value
    name = bytes(value).decode("utf-8", "replace")
    grade = random.choice(["A", "B+", "B", "C+", "C", "D"])
    reply = f"{name} - Your grade is {grade}."
    current_value = bytearray(reply.encode("utf-8"))
    print(f"WRITE <- {name!r}  (next read: {reply!r})")


async def main():
    server = BlessServer(name=DEVICE_NAME)
    server.read_request_func = on_read
    server.write_request_func = on_write

    await server.add_new_service(SERVICE_UUID)
    await server.add_new_characteristic(
        SERVICE_UUID,
        CHAR_UUID,
        GATTCharacteristicProperties.read | GATTCharacteristicProperties.write,
        None,
        GATTAttributePermissions.readable | GATTAttributePermissions.writeable,
    )
    await server.start()
    print(f"Advertising as {DEVICE_NAME!r}. Scan from the app, then read/write. Ctrl+C to stop.")
    try:
        await asyncio.Event().wait()
    finally:
        await server.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
