# opc-tunner

โปรแกรม gateway/tunnel ที่แปลง **OPC DA → OPC UA** อัตโนมัติ เพื่อให้เครื่องอื่นในเครือข่าย
"อ่าน" ค่าจาก OPC DA server (เช่น PLC/SCADA driver รุ่นเก่า) ผ่านโปรโตคอล **OPC UA** ได้เลย
โดยไม่ต้องตั้งค่า DCOM/OPC Enum บนเครื่อง client แต่ละเครื่อง และไม่ต้อง config รายชื่อ tag ทีละตัว
(โปรแกรมจะ browse แล้ว mirror tag ทั้งหมดให้อัตโนมัติ)

## ทำไมถึงไม่ต้อง config OPC Enum ที่เครื่อง client

OPC DA แบบดั้งเดิมพึ่งพา **DCOM** ในการสื่อสาร ซึ่งต้องมีบริการ `OPC Enum` (opcenum.exe)
ทำหน้าที่ enumerate รายชื่อ OPC server ให้ client ผ่านเครือข่าย — ต้องตั้งค่า DCOM permission,
Windows security identity, และ firewall ให้ตรงกันทุกเครื่องที่จะอ่านข้อมูล ซึ่งเป็นจุดที่ปวดหัวที่สุด
ของ OPC DA แบบ remote

**OPC UA** ไม่ใช้ DCOM เลย — เป็นการเชื่อมต่อผ่าน TCP port เดียว (`opc.tcp://host:port/path`)
มี security model ของตัวเอง (certificate / username-password / anonymous) ดังนั้นเครื่อง client
ที่จะมาอ่านข้อมูลจึงแค่ต้องมี **OPC UA client software** ทั่วไป (เช่น UaExpert, Ignition,
Node-RED, Python `asyncua`, ฯลฯ) ชี้ไปที่ endpoint เดียวนี้ — ไม่ต้อง config DCOM/OPC Enum
หรือลงโปรแกรมอะไรเพิ่มเลยนอกจาก OPC UA client ที่ตัวเองมีอยู่แล้ว

## สถาปัตยกรรม

```
 PLC/DCS ──(protocol เฉพาะ vendor)── OPC DA Server
                                          │  DCOM (จุดเดียว ตั้งค่าครั้งเดียว)
                                          ▼
                                    ┌───────────┐
                                    │ opc-tunner │  <-- ตัวโปรแกรมนี้ ลงที่เดียว
                                    │  (gateway) │
                                    └───────────┘
                                          │  OPC UA over opc.tcp:// (พอร์ตเดียว)
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              UaExpert (PC A)      Ignition (PC B)        Node-RED (PC C)
             ไม่ต้อง config อะไร     ไม่ต้อง config อะไร      ไม่ต้อง config อะไร
```

DCOM ยังจำเป็นอยู่ "หนึ่งจุด" คือระหว่าง `opc-tunner` กับ OPC DA server เท่านั้น (เพราะเป็น
ข้อจำกัดของโปรโตคอล OPC DA เอง แก้ไม่ได้) แต่ตั้งค่าเพียงครั้งเดียวที่จุดนี้ ไม่ต้องทำซ้ำที่ทุกเครื่อง client อีกต่อไป

## ติดตั้งน้อยที่สุดได้อย่างไร

- `opc-tunner` เขียนด้วย **Node.js** ล้วน ๆ (ไม่มี native addon, ไม่ต้องคอมไพล์) ใช้ไลบรารี
  [`node-dcom`](https://github.com/netsmarttech/node-dcom) ที่ reimplement โปรโตคอล DCOM/DCE-RPC
  เป็น pure JavaScript เอง — จึงไม่ต้องติดตั้งซอฟต์แวร์ OPC client จากค่ายต่าง ๆ
  (เช่น Matrikon OPC Explorer, Kepware, OPC Core Components) บนเครื่องที่รัน gateway เลย
- เครื่องที่รัน `opc-tunner` แค่ต้องมี **Node.js** และ network access ไปหา OPC DA server
  (แม้กระทั่ง Linux ก็รันได้ เพราะ DCOM ถูกพูดผ่าน socket ตรง ๆ ไม่พึ่ง Windows COM stack)
- เครื่อง client (ฝั่งอ่านข้อมูล) ไม่ต้องลงอะไรใหม่เลยนอกจาก OPC UA client ที่มีอยู่แล้ว

**เครื่องที่รัน gateway ไม่มีอินเทอร์เน็ต ทำได้อย่างไร?** ดู [`packaging/README.md`](packaging/README.md) —
มีขั้นตอนสร้างแพ็กเกจแบบไฟล์เดียว (`npm run bundle`) บนเครื่องที่มีเน็ต แล้วก็อปทั้งโฟลเดอร์
ไปเครื่องเป้าหมายผ่าน USB/แชร์ไฟล์ได้เลย ไม่ต้อง `npm install` หรือต่อเน็ตที่เครื่องปลายทางอีก

## เริ่มต้นใช้งาน

```bash
npm install
cp config/config.example.yaml config/config.yaml   # แก้ค่าตามหน้างาน
npm run build
npm start                 # หรือ `npm run dev` ระหว่างพัฒนา (รันตรงจาก TypeScript)
```

ค่าเริ่มต้นของ `config.yaml` ใช้ `da.mode: simulated` คือมี DA server จำลองในตัว (tag ปลอม 4 ตัว
ที่มีค่าขยับไปเรื่อย ๆ) เพื่อให้ลองใช้งาน gateway และต่อ OPC UA client ทดสอบได้ทันทีโดยยังไม่ต้องมี
DA server จริง

เมื่อรันแล้ว ให้เปิด OPC UA client (เช่น UaExpert) แล้วต่อไปที่:

```
opc.tcp://<host-ที่รัน-opc-tunner>:4840/opc-tunner
```

จะเห็น tag ทั้งหมดถูก mirror มาเป็น folder tree ใต้ `Objects` โดยอัตโนมัติ

## ต่อกับ OPC DA server จริง

แก้ `config/config.yaml`:

```yaml
da:
  mode: node-opc-da
  pollIntervalMs: 1000
  nodeOpcDa:
    host: 192.168.1.50
    domain: WORKGROUP
    username: opcuser
    password: "change-me"
    clsid: "{F8582CF2-88FB-11D0-B850-00C0F0104305}"
```

หมายเหตุ:

- `clsid` ต้องเป็น **CLSID (GUID)** ของ OPC DA server เป้าหมาย ไม่ใช่ ProgID — หาได้ครั้งเดียวจาก
  `HKEY_CLASSES_ROOT\CLSID` บนเครื่องที่รัน DA server หรือจากเอกสารของ vendor
- ฝั่ง DA server (และ DCOM/Windows account ที่ใช้เชื่อมต่อ) ยังต้องตั้งค่าให้ `opc-tunner`
  เชื่อมต่อได้ตามปกติของ OPC DA — นี่คือจุดเดียวที่ยังต้องแตะ DCOM ตามที่อธิบายไว้ข้างต้น
- ตอนนี้ gateway เป็น **read-only** (อ่านค่าอย่างเดียว ยังไม่รองรับการเขียนค่ากลับไปที่ DA server)
  ซึ่งตรงกับโจทย์ "ให้เครื่องอื่นมาอ่านได้" — ถ้าต้องการ write-back สามารถต่อยอดเพิ่มได้ภายหลัง
- `da.includePrefixes` ปล่อยว่างไว้ (ค่า default) เพื่อ mirror ทุก tag อัตโนมัติโดยไม่ต้อง config
  ทีละตัว — ใส่ prefix เฉพาะถ้าต้องการจำกัดว่าจะ mirror เฉพาะบาง path เท่านั้น

## โครงสร้างโค้ด

```
src/
  da/            interface ของ DA client (DaClientAdapter) + adapter จริง (node-opc-da)
                 และ adapter จำลอง (SimulatedDaAdapter) สำหรับทดสอบ/สาธิตโดยไม่ต้องมี DA server
  bridge/        TagBridge - browse tag อัตโนมัติ, poll ค่า, ส่งเข้า UA server
  ua/            ครอบ node-opcua สร้าง address space ตาม path ของ DA tag
  config.ts      โหลด/validate config.yaml
  index.ts       entry point
test/            end-to-end test: simulated DA -> UA server -> UA client จริง (vitest)
```

## ทดสอบ

```bash
npm test
```

เทสจะสร้าง DA server จำลอง, เปิด OPC UA server จริงบน localhost, แล้วต่อด้วย OPC UA client จริง
(`node-opcua`) เพื่อยืนยันว่า tag ถูก auto-discover, browse เจอ, และค่าที่อ่านได้อัปเดตตามเวลาจริง

## ข้อจำกัดที่ควรรู้

- `node-opc-da` เป็นไลบรารี community ที่รองรับเฉพาะ browse + synchronous read (ยังไม่มี
  async subscription หรือ write ในตัวไลบรารี) — gateway นี้จึงจำลอง subscription ด้วยการ
  poll ตามรอบเวลาที่ตั้งไว้แทน ซึ่งเพียงพอสำหรับงาน monitoring/dashboard ทั่วไป
- ควรทดสอบกับ OPC DA server จริงของหน้างานก่อนใช้งานจริง เพราะการ implement DCOM/OPC-DA
  ของแต่ละ vendor มีรายละเอียดปลีกย่อยต่างกัน
