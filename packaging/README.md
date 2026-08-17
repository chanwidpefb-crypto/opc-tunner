# ติดตั้งบนเครื่องที่ไม่มีอินเทอร์เน็ต (แบบก็อปไฟล์อย่างเดียว)

ทำ 2 ขั้นตอนนี้บน **เครื่องที่มีเน็ต** เครื่องใดก็ได้ (เครื่อง dev, โน้ตบุ๊กสำรอง ฯลฯ) แล้วก็อป
โฟลเดอร์ที่ได้ไปเครื่องเป้าหมายผ่าน USB/แชร์ไฟล์ — เครื่องเป้าหมายไม่ต้องต่อเน็ตหรือรัน `npm install` เลย

## ขั้นตอนที่ 1 — สร้างแพ็กเกจออฟไลน์ (บนเครื่องที่มีเน็ต)

```bash
npm install
npm run bundle
```

จะได้โฟลเดอร์ `dist-offline/` ที่รวมทุกอย่างที่แอปต้องใช้ไว้ในไฟล์เดียว:

```
dist-offline/
  opc-tunner.cjs              <- ตัวโปรแกรมทั้งหมด (bundle เดียว รวม dependency ทุกตัวแล้ว)
  nodesets/Opc.Ua.NodeSet2.xml
  config/config.example.yaml
  start-windows.bat
```

## ขั้นตอนที่ 2 — เลือกวิธีให้เครื่องเป้าหมายมี Node.js runtime

เครื่องเป้าหมายยังต้องมี **Node.js runtime** เพื่อรัน `opc-tunner.cjs` เลือกได้ 2 แบบ:

### แบบ A: พก Node.js แบบพกพา (portable, ไม่ต้องติดตั้ง/ไม่ต้องสิทธิ์ admin)

1. บนเครื่องที่มีเน็ต โหลดไฟล์ zip อย่างเป็นทางการจาก nodejs.org
   (เช่น `node-v18.20.8-win-x64.zip` — เลือกเวอร์ชัน LTS, "Windows Binary (.zip)")
2. แตก zip ได้โฟลเดอร์ที่มี `node.exe` อยู่ข้างใน — เปลี่ยนชื่อโฟลเดอร์นั้นเป็น `node`
3. วางโฟลเดอร์ `node/` ไว้ **ข้างใน** `dist-offline/` ให้ได้โครงสร้างแบบนี้:

   ```
   dist-offline/
     node/
       node.exe
       ...
     opc-tunner.cjs
     nodesets/
     config/
     start-windows.bat
   ```

4. ก็อปทั้งโฟลเดอร์ `dist-offline/` ไปเครื่องเป้าหมาย แก้ `config/config.yaml` ตามหน้างาน
   แล้วดับเบิลคลิก `start-windows.bat` ได้เลย — ไม่ต้องติดตั้งอะไรทั้งสิ้น

### แบบ B: อัดเป็น .exe ตัวเดียว (ต้องเตรียมบนเครื่องที่มีเน็ตไม่จำกัด)

ใช้ [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg) แปลง `opc-tunner.cjs` เป็น `.exe` ที่ฝัง Node.js
runtime มาในตัวเลย — ได้ไฟล์เดียวจบ ไม่ต้องมีโฟลเดอร์ `node/` แยก:

```bash
npm install --save-dev @yao-pkg/pkg
npx pkg dist-offline/opc-tunner.cjs --targets node18-win-x64 --output dist-offline/opc-tunner.exe
```

> หมายเหตุ: คำสั่งนี้ต้องดาวน์โหลด Node.js binary ที่คอมไพล์ไว้ล่วงหน้าจาก GitHub releases
> ของ `pkg-fetch` — ต้องรันบนเครื่องที่ต่อเน็ตแบบไม่มีการจำกัด (ทดสอบใน sandbox ของ session นี้
> ไม่สำเร็จเพราะนโยบายเครือข่ายจำกัดการเข้าถึง GitHub releases ไว้ ลองรันบนคอมพิวเตอร์ปกติของคุณแทน)

จากนั้นก็อปแค่ `opc-tunner.exe` + `nodesets/` + `config/` ไปเครื่องเป้าหมาย รันด้วยการดับเบิลคลิก
หรือ `opc-tunner.exe config\config.yaml`

## ทำไมย้ายไฟล์แบบนี้ได้ทั้งดุ้น

- ทั้ง `node-opcua` และ `node-opc-da`/`node-dcom` เป็น pure JavaScript ไม่มีส่วนที่ต้องคอมไพล์
  เฉพาะเครื่อง (native addon) จึงเอาไฟล์เดียว (`opc-tunner.cjs`) ไปรันข้ามเครื่องได้ทันที
  ขอแค่สถาปัตยกรรม/OS ของ Node.js runtime (แบบ A) หรือของ .exe (แบบ B) ตรงกับเครื่องเป้าหมาย
- ไฟล์ `nodesets/Opc.Ua.NodeSet2.xml` เป็นไฟล์ข้อมูล (ไม่ใช่โค้ด) ที่ node-opcua ต้องอ่านตอนเริ่มทำงาน
  จึงต้องก็อปติดไปด้วยเสมอ วางไว้ในโฟลเดอร์ `nodesets/` ข้าง ๆ `opc-tunner.cjs`/`opc-tunner.exe`
  แล้วโปรแกรมจะหาเจอเอง
