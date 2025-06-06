# tạo ra một hệ thống earn bằng việc tương tác và cho pet ăn và market buôn bán & battle

# Cấu trúc của pet
# Việc định nghĩa name, type như nào thì hệ thống sẽ định nghĩa bằng các dữ liệu có thể điều chỉnh và nó là shared object chỉ có admin mới có thể điều chỉnh dữ liệu này. Một cách ngẫu nhiên bằng SUI:RANDOM tại smart contract
- id: UID
- pet_name: vector<u8>
- pet_type: vector<u8>
- pet_level: u64
- earned_amount: u256
- earned_balance: u256
- base_earn_level_percent: u256
- total_earned_amount: u256
- hungry_timestamp_ms: u64
- created_at_timestamp_ms: u64
- claimed_at_timestamp_ms: u64

# Cấu trúc của food
- id: UID
- food_name: vector<u8>
- food_type: vector<u8>
- food_level: u64

# Cấu trúc config của admin
# SHARED OBJECT
- id: UID
- pets: vector<{
    - pet_name: vector<u8>
    - pet_type: vector<u8>
    - pet_level: u64
    - max_food_level: u64
    - base_earn_level_percent: u256
    - rate: u64
}>
- foods: vector<{
    food_name: vector<u8>
    food_type: vector<u8>
    food_level: u64
    food_price: u256
}>
- pet_price: u256
- pet_upgrade_base_price: u256
- hungry_secs_per_level: u64
- earn_per_sec: u256

# Cơ chế game
# việc tạo ra pet sẽ là ngẫu nhiên theo rate được định sẵn trong config
# pet_name và pet_type sẽ được định nghĩa ngẫu nhiên theo object được đặt sẵn từ admin tại một shared object nhưng object đó được control bởi admin
# pet_level lúc mới tạo sẽ luôn là 0 hoặc có phần mua (vv).
# max_food_level là level ăn mà pet đó đạt giới hạn (mức level của việc ăn no)
# base_earn_level_percent là phần trăm được cộng thêm khi pet nâng cấp level, cái này sẽ tăng mãi mãi theo số lần upgrade level
# rate là tỉ lệ quay ra của pet nếu là 0 thì sẽ không thể nào quay ra được.
# earned_amount thì là số lượng token mà cái đó đã earned được (phần này sẽ là con số dã convert sang token của game)
# chỉ số và cơ chế earned sẽ thông qua dữ liệu từ shared object của admin đã được chỉ định.
# total_earned_amount là tổng tăng dần của earned_amount và không bao giờ trừ
# hungry_timestamp_ms là thời gian mà nó đã đói và không thể earn được nếu như nó đói và trừ khi cho nó ăn lại thì mới earn được trong khoản đó.
# created_at_timestamp_ms là lúc mà pet được tạo ra sử dụng sui time luôn.
# claimed_at_timestamp_ms là lần claimed gần nhất của pet đó.
# cơ chế earn: (hungry_timestamp_ms - claimed_at_timestamp_ms) / 1000 / earn_per_sec

# Prompt tạo smart contract
<!-- ```prompt -->
tạo giúp tôi một smart contract của SUI như sau.

trước tiên tôi cần kiểm tra chắc chắn cách triển khai mới nhất và docs mới nhất của sui để có thể triển khai một cách tốt nhất và cần triển khai một cách bảo mật và tránh bugs.

- có 2 module, 1 module của cơ chế game và 1 module của publisher để tuỳ chỉnh cơ chế game là config.

# Cấu trúc config của admin
# SHARED OBJECT
# ở phần cơ chế pets và cả foods thì tôi chưa nghĩ ra dùng index như thế nào cho phù hợp với việc truy xuất chuẩn xác từ phía mechanics và có thể bị ảnh hưởng khi thêm vào xoá pet hoặc food trong config.
- id: UID
- pets: vector<{
    - pet_name: vector<u8>
    - pet_type: vector<u8>
    - pet_level: u64
    - max_food_level: u64
    - base_earn_level_percent: u256
    - rate: u64
}>
- foods: vector<{
    food_name: vector<u8>
    food_type: vector<u8>
    food_level: u64
    food_price: u256
}>
- pet_price: u256
- pet_upgrade_base_price: u256
- hungry_secs_per_level: u64
- earn_per_sec: u256

# - module config:
 - khi init sẽ tạo ra 1 shared object kèm và sẽ có parameter truyền vào là một cái public_key để xác nhận đó là admin hoặc có thể dùng luôn public_key của publisher cũng được miền là sau đó khi tuỳ chỉnh thông số thì cần verify signature để đảm bảo chỉ admin mới có quyền tuỳ chỉnh config.
 - config sẽ có phần tuỳ chỉnh pets như sau:
  - edit_pet_name(pet_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, pet_name: vector<u8>)
  - edit_pet_type(pet_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, pet_type: vector<u8>)
  - edit_pet_max_food_level(pet_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, max_food_level: u64)
  - edit_pet_base_earn_level_percent(pet_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, base_earn_level_percent: u256)
  - edit_pet_rate(pet_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, rate: u64)
  - add_pet(pet_name: vector<u8>, pet_type: vector<u8>, rate: u64)
  - remove_pet(pet_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác)
 
 - config sẽ có phần tuỳ chỉnh foods như sau:
    - edit_food_name(food_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, food_name: vector<u8>)
    - edit_food_type(food_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, food_type: vector<u8>)
    - edit_food_level(food_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, food_level: u64)
    - edit_food_price(food_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác, food_price: u256)
    - add_food(food_name: vector<u8>, food_type: vector<u8>, food_level: u64, food_price: u256)
    - remove_food(food_id: đại khái phần này sẽ truyền vào index hoặc cái gì đó để tuỳ chỉnh thông số của pet một cách chính xác)

 - config sẽ chỉnh phần pet_price như sau:
    - set_pet_price(pet_price: u256)

 - config sẽ chỉnh phần pet_upgrade_base_price như sau:
    - set_pet_upgrade_base_price(pet_upgrade_base_price: u256)

 - config sẽ chỉnh phần hungry_secs_per_level như sau:
    - set_hungry_secs_per_level(hungry_secs_per_level: u64)

 - config sẽ chỉnh earn_per_sec như sau:
  - edit_earn_per_sec(earn_per_sec: u256)

-lưu ý phần config:
 - cần phải triển khai làm sao cho bảo mật tránh việc hacker sử dụng lại signature.

- phần config này sau khi tạo cái shared object thì cần implement truyền sang cho bên module mechanics để bên đó khi sử dụng function sẽ base trên dữ liệu của shared object này mà tinh chỉnh cho phù hợp.

- module mechanics:

thì sẽ có public struct Pet có key và store và cấu trúc như sau:
- id: UID
- pet_name: vector<u8>
- pet_type: vector<u8>
- pet_level: u64
- earned_amount: u256
- earned_balance: u256
- base_earn_level_percent: u256
- total_earned_amount: u256
- hungry_timestamp_ms: u64
- created_at_timestamp_ms: u64
- claimed_at_timestamp_ms: u64

thì sẽ có public struct Food có key và store và drop và cấu trúc như sau:
- id: UID
- food_name: vector<u8>
- food_type: vector<u8>
- food_level: u64

một cơ chế treasury để users mua pet bằng sui và treasury có thể rút được bới admin.
cơ chế này nên thiết kế và triển khai ở module config luôn thì hay.

khai báo thuật toán:
math_(tính toán để cộng max hungry_timestamp_ms): (thời gian hiện tại của SUI) + (hungry_secs_per_level * 1000 * max_food_level)
math_(tính toán để cộng hungry_timestamp_ms theo food level): (hungry_timestamp_ms hiện tại) + (hungry_secs_per_level * 1000 * food_level)
math_(tính toán earned_amount): (hungry_timestamp_ms - claimed_at_timestamp_ms) / 1000 * (earn_per_sec + (earn_per_sec / 100 * base_earn_level_percent))

function tạo pet (có thể tự tạo name theo kiểu snake nhé):
 - trước tiên là mỗi lần tạo pet sẽ mất (pet_price: 5 SUI) để tạo ra.
 - phần sui này cần đưa vào treasury sui của dự án và có thể rút ra.
 - sau khi qua bước (pet_price: 5 SUI) thì sẽ đến phần tạo Pet.
 - trước tiên cần sử dụng thuật toán sui::random ngẫu nhiên Pet từ config pets và chọn ngẫu nhiên một Pet trong dang sách config đã được tạo ra. và cần chọn theo rate nữa nhé, tức là sẽ chọn ngẫu nhiên nhưng từng pet có từng rate thì cần trung bình của pet lại rồi ngẫu nhiên là được, pet mà có rate 0 thì sẽ coi như không được chọn nữa.
 - sau đó chọn ra một pet và dựa trên 3 field là: pet_name, pet_type, pet_level và tạo ra pet mới với 3 field này và những field như:
  - earned_amount: thì sẽ là 0,
  - - earned_balance: u256: thì sẽ là 0 (cái này là cái mà trách việc bug lúc ăn và lúc claim)
  - hungry_timestamp_ms: thì sẽ là thời gian hiện tại của SUI + thêm (hungry_secs_per_level * 1000 * max_food_level): đại khái là thời gian hiện tại + thêm để nâng mức đói ở level nào đó ở mức nào đó.
  - created_at_timestamp_ms: là lúc tạo ra pet sử dụng timestamp của SUI.
  - claimed_at_timestamp_ms: là lúc mà user nhấn claim còn lúc mơi tạo thì sẽ để là hiện tại như cái created_at_timestamp_ms: luôn.
  - sau khi tạo Pet rồi thì sẽ public transfer tới người tạo.

function nâng cấp pet (có thể tự tạo name theo kiểu snake nhé):
 - trước tiên cần truyền vào Pet cần nâng cấp vào parameter.
 - tính toán số SUI cần thiết cho việc upgrade theo thuật toán là: pet_upgrade_base_price + (pet_upgrade_base_price / 10 * (pet_level + 1))
 - sau khi kiểm tra đã đủ SUI và phù hợp thì sẽ sang bước tiếp theo là cộng pet_level lên thêm + 1
 - và phần base_earned_pecent của pet đó sẽ cộng thêm như này ```base_earned_pecent = base_earned_pecent + (base_earned_pecent / 100 * base_earn_level_percent)```

function cho pet ăn (có thể tự tạo name theo kiểu snake nhé):
 - trước tiên cần truyền Pet và Food vào parameter đang có.
 - rồi kiểm tra xem là thời gian hiện tại có lớn hơn hungry_timestamp_ms không:
  - nếu có thì sẽ đặt các field như sau:
   - earned_balance: math_(tính toán earned_amount)
   - hungry_timestamp_ms: sẽ đặt về thời gian hiện tại của sui
   - claimed_at_timestamp_ms: sẽ đặt về thời gian hiện tại của sui
 - sau đó lấy level của food ra và sử dụng cái thuật toán để cập nhật lại hungry_timestamp_ms
 - thuật toán là: math_(tính toán để cộng hungry_timestamp_ms theo food level) và nếu nó lớn hơn math_(tính toán để cộng max hungry_timestamp_ms) thì sẽ chọn cái math_(tính toán để cộng max hungry_timestamp_ms) nhé không được cho nó vượt quá mức cho phép.
 - sau khi cập nhật xong thì sẽ xoá cái food đó vĩnh viễn và trả về pet mới nhất cho user (đại khái phần này là xong rồi có thể tự quyết sau khi xoá cho hợp lý nhất)



trong lúc triển khai cần xem kĩ các ability cần thiết giữa config và mechanics.

cần code kĩ nhé.
<!-- ``` -->


# Frontend - Client

Có 3 Sides.
["Pets", "Market", "Battle (Coming soon...)"]

 - Pets
  - Sẽ hiện Full Pets và show đơn giản các thông tin như name hoặc level.
  - Sẽ Select được vào và sau khi select thì sẽ:
    - Hiện full thông tin và các chỉ số: ví dụ đang farm được bao nhiêu (vv)
    - Kèm theo button Listing để đưa lên market và bán pets đó với số lượng SUI đó.
 - Markets
  - Sẽ có 2 phần ["Pets", "Foods"] thêm một screen Mint nữa để call hàm create_pet và sẽ nhận lại pet ngay lập tức.
  - Phần Pets sẽ bao gồm tất cả những Pets mà những users khác đã listing để bán. (phần này có thể thêm offer nếu cần)
  - Phần Foods sẽ shows lên những foods đã config ở trên module config.
  - Phần Battle chỉ để cho có để việc mở rộng được xem là còn.

Package ID:
0x996d18738dbad3be88f1482e6fb551b6a27144dd86b3e0fa0d7d8b226c65905a

Token Treasury Object ID:
0xf1a030f2e1f688dcd0ac22f82afd52c491f937dfb83e7d0ff8ec534b0f1b4566

Game Token Object ID:
0x3c7c1f1889b48025dda5f5f4cec864f2d6bba8a948c6a735668916ba77898984

Config Object ID:
0xa655f7e35790589cd924b25ce9c370506e30e066c59db051606058f1b6de848e

Admin Cap Object ID:
0x760a7725e559174c5cc9a94d06794d39c8fd991ba7b2c6c9a3063722938f5d25

Treasury Object ID:
0xe50db93b0fc08787bbc64bbf7403f4754e843c64a52b95c7bf99dd3750e6b686

sui client call \
  --package 0x996d18738dbad3be88f1482e6fb551b6a27144dd86b3e0fa0d7d8b226c65905a \
  --module mechanics \
  --function buy_food \
  --args 0xa655f7e35790589cd924b25ce9c370506e30e066c59db051606058f1b6de848e \
         0xe50db93b0fc08787bbc64bbf7403f4754e843c64a52b95c7bf99dd3750e6b686 \
         0 \
         0xfa9b096c26e24bb9a3f8db5994e7428f5551cd80e88f85281cb4c19e9ad1aaca

# add pet to config
# level: 0
# max_food_level: 10
# base_earn_level_percent: 20 # chỉ số tăng dần & theo base level percent
sui client call \
  --package <ID> \
  --module config \
  --function add_pet \
  --args <ID> \
         <ID> \
         "Dog" \
         "Normal" \
         0 \
         10 \
         20 \
         100 \
  --gas-budget 100000000

# create random pet to caller
sui client call \
  --package <ID> \
  --module mechanics \
  --function create_pet \
  --args <ID> \
         <ID> \
         0x8 \
         0x6 \
         <ID> \
  --gas-budget 100000000

# add food to config
sui client call \
  --package <ID> \
  --module config \
  --function add_food \
  --args <ID> \
         <ID> \
         "Meat" \
         "Normal" \
         1 \
         1000000000 \
  --gas-budget 100000000

# buy the food just add by id: 0
sui client call \
  --package <ID> \
  --module mechanics \
  --function buy_food \
  --args <ID> \
         <ID> \
         0 \
         <ID> \
  --gas-budget 100000000

# Feed Ped
sui client call \
  --package <ID> \
  --module mechanics \
  --function feed_pet \
  --args <ID> \
         <ID> \
         <ID> \
         0x6 \
  --gas-budget 100000000

# Claim Rewards
sui client call \
  --package <ID> \
  --module mechanics \
  --function claim_pet \
  --args <ID> \
         <ID> \
         <ID> \
         0x6 \
  --gas-budget 100000000

### finished the test ###


## start on testnet

# Thêm Pet: Dog (thường)
sui client call \
  --package 0x996d18738dbad3be88f1482e6fb551b6a27144dd86b3e0fa0d7d8b226c65905a \
  --module config \
  --function add_pet \
  --args 0xa655f7e35790589cd924b25ce9c370506e30e066c59db051606058f1b6de848e \
         0x760a7725e559174c5cc9a94d06794d39c8fd991ba7b2c6c9a3063722938f5d25 \
         "Dog" \
         "Normal" \
         0 \
         10 \
         50 \
         100 \
  --gas-budget 100000000

# Thêm Pet: Dragon (hiếm)
sui client call \
  --package 0x996d18738dbad3be88f1482e6fb551b6a27144dd86b3e0fa0d7d8b226c65905a \
  --module config \
  --function add_pet \
  --args 0xa655f7e35790589cd924b25ce9c370506e30e066c59db051606058f1b6de848e \
         0x760a7725e559174c5cc9a94d06794d39c8fd991ba7b2c6c9a3063722938f5d25 \
         "Dragon" \
         "Rare" \
         0 \
         15 \
         100 \
         50 \
  --gas-budget 100000000

# Thêm Food: Meat (thường)
sui client call \
  --package 0x996d18738dbad3be88f1482e6fb551b6a27144dd86b3e0fa0d7d8b226c65905a \
  --module config \
  --function add_food \
  --args 0xa655f7e35790589cd924b25ce9c370506e30e066c59db051606058f1b6de848e \
         0x760a7725e559174c5cc9a94d06794d39c8fd991ba7b2c6c9a3063722938f5d25 \
         "Meat" \
         "Normal" \
         1 \
         500000000 \
  --gas-budget 100000000

# Thêm Food: Fish (cao cấp)
sui client call \
  --package 0x996d18738dbad3be88f1482e6fb551b6a27144dd86b3e0fa0d7d8b226c65905a \
  --module config \
  --function add_food \
  --args 0xa655f7e35790589cd924b25ce9c370506e30e066c59db051606058f1b6de848e \
         0x760a7725e559174c5cc9a94d06794d39c8fd991ba7b2c6c9a3063722938f5d25 \
         "Fish" \
         "Premium" \
         3 \
         1500000000 \
  --gas-budget 100000000