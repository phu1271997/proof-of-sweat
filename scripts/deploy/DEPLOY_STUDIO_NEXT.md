# 🚀 Deploying Proof of Sweat on GenLayer Studio Next

> **Bắt buộc cho Hackathon:** GenLayer yêu cầu dự án phải được deploy trên **Studio Next** (chạy Consensus v0.6 với cơ chế fee mới) để được chấp nhận vào hackathon.

---

## 1. Thông số mạng Studio Next

| Thuộc tính | Giá trị |
|---|---|
| **Network Name** | GenLayer Studio Next |
| **RPC URL** | `https://studio-next.genlayer.com/api` |
| **Chain ID** | `61997` (Hex: `0xF22D`) |
| **Block Explorer** | `https://explorer-studio-dev.genlayer.com/` |
| **Web IDE Studio** | `https://studio-next.genlayer.com/contracts` |
| **Native Token** | GEN (18 decimals) |

---

## 2. Quy trình Deploy trên Studio Next (Từng bước)

### Bước 1: Mở GenLayer Studio Next
Truy cập: [https://studio-next.genlayer.com/contracts](https://studio-next.genlayer.com/contracts)

### Bước 2: Tạo file Contract
1. Trong panel bên trái (**Files**), bấm icon **New File** (hoặc chuột phải chọn New File).
2. Đặt tên file: `proof_of_sweat.py`.

### Bước 3: Copy mã nguồn Contract
Mở file [`contracts/proof_of_sweat_studio_next.py`](../../contracts/proof_of_sweat_studio_next.py) trong repo này, copy toàn bộ nội dung và dán vào editor của Studio Next.

> ⚠️ **Lưu ý dòng Header (Pragma):** 
> Studio Next sử dụng runtime GenVM v0.3.0. Dòng đầu tiên của contract bắt buộc là:
> ```python
> # v0.3.0
> # { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
> ```

### Bước 4: Kiểm tra Schema trên tab Run & Debug
1. Bấm vào tab **Run & Debug** ở thanh bên phải.
2. Studio Next sẽ tự động phân tích cú pháp contract và hiển thị schema với các methods:
   - `create_bounty`
   - `claim_bounty`
   - `submit_work`
   - `adjudicate`
   - `appeal`
   - `withdraw`
   - `get_bounty`, `get_all_bounties`, v.v.

### Bước 5: Chuẩn bị Account có GEN
1. Mở panel **Accounts** (ở góc dưới bên trái hoặc thanh công cụ).
2. Kiểm tra tài khoản Studio có số dư GEN không. Nếu là 0, nhập số lượng (ví dụ `10`) rồi bấm **Fund Account**.

### Bước 6: Tiến hành Deploy
1. Trong tab **Run & Debug**, cuộn tới phần **Deploy**.
2. Contract `proof_of_sweat.py` không yêu cầu tham số constructor trong `__init__`.
3. Bấm nút **Deploy**.
4. Studio Next sẽ tự động tính toán phí giao dịch (`FeesDistribution`), ký và gửi transaction tới mạng consensus.

### Bước 7: Xác nhận kết quả On-Chain
Contract đã được deploy thành công tại:
- **Contract Address:** `0xF50d94C96dbE81e3b15Eb8fd0e4De24F1690b3f6`
- **Explorer:** https://explorer-studio-dev.genlayer.com/address/0xF50d94C96dbE81e3b15Eb8fd0e4De24F1690b3f6

---

## 3. Cách Deploy nhanh bằng Script CLI (Automated)

Bạn có thể chạy script deploy tự động sử dụng private key từ `~/.genlayer/env.sh`:
```bash
source ~/.genlayer/env.sh
node scripts/deploy/deploy_studio_next.js
```
Script sẽ tự động:
- Đọc code contract từ `contracts/proof_of_sweat_studio_next.py`
- Ước tính phí giao dịch trên Studio Next (`estimateTransactionFees`)
- Ký và gửi transaction deploy qua `genlayer-js`
- Chờ quorum validator đồng thuận và in ra địa chỉ contract cùng schema.

---

## 4. Cập nhật Frontend dApp

Frontend đã được cấu hình trỏ tới contract mới:
```env
VITE_CONTRACT_ADDRESS=0xF50d94C96dbE81e3b15Eb8fd0e4De24F1690b3f6
VITE_ARC_CONTRACT_ADDRESS=0xd898EF839DE88dE38113f0560F8fEBEff73D09c8
```

2. Frontend đã được nâng cấp tương thích hoàn toàn:
   - `@genlayer/transaction-kit@0.1.0-rc.2`
   - `@genlayer/transaction-kit-react@0.1.0-rc.2`
   - `genlayer-js@2.0.0-rc.1`
   - Tự động gợi ý MetaMask thêm/chuyển mạng sang **GenLayer Studio Next (Chain ID: 61997)**.

3. Chạy frontend:
   ```bash
   cd frontend
   npm run dev
   ```

4. Nạp GEN cho ví MetaMask trên Studio Next:
   - Trong Studio Next (tab **Accounts**), chuyển một ít GEN (ví dụ 5 GEN) sang địa chỉ ví MetaMask của bạn để có số dư thực hiện các tác vụ (tạo bounty, stake, tương tác AI).
