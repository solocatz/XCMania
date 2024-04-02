# Alps2使用说明书

Alps2是一款超大音量的厘米瞬响高度表，为捕捉弱气流而生。

Alps2使用欧洲主流软件与硬件规格，可无缝配合XCMania或欧洲主流手机应用。

## 音量调节

开机后。电源开关充当音量调节，按一下电源键换音量到下一档。共5档音量可调。
部分新固件还额外支持一个静音档。

## 按键操作

● 长按开关键
○ 按3秒开/关机
○ 开机后需要10秒初始化，期间绿灯常亮不会响应高度变化。10秒后可以听到三声OK音。
● 开机后，会有1至5声短促音告知电池电量。
○ 5声为电池剩余容量 >90%
○ 4声为电池剩余容量80%
○ 3声为电池剩余容量50%
○ 2声为电池剩余容量15%
○ 1声表明电池剩余容量过低，需要充电。
● 飞行中短按开关键
○ 回到准备起飞静默状态（暂时关闭气流嗅探的“哒哒”声）.

## 状态灯

● 启动/校准中
○ 绿灯常亮
● 准备起飞
○ 绿灯每秒闪烁一次
○ 起飞前部分静音状态（边缘检测不会响起）
● 飞行中
○ 绿灯每5秒闪烁一次
● 充电中
○ 红色灯常亮
○ 充电结束红色灯熄灭

## 初始化

● 每次开机后传感器需要约10秒对传感器初始化。
● 初始化过程无需静止。包括飞行中都可随时开关机。
● 姿态校准完成后，会发出准备完毕音乐(C6 E6 F6)提示。
● 初始化期间不会响应高度变化。

## 首次使用/强化校准

● 当仪器出现过灵敏（静置也会发出上升音）/过迟钝（对抬升反应迟缓）现象时，需要强化校准。
● 强化校准步骤如下：
○ 在环境中放置10分钟，使仪器温度于环境温度相同
○ 仪器关机
○ 将仪器太阳能板向上，放置在水平、无振动平面
○ 开机
○ 等待40秒
○ 如听到5声音乐则表明成功，其间如有移动则校准自动终止

## 与手机配对

低功耗蓝牙（BLE）不同于蓝牙耳机，不能使用手机厂商提供的蓝牙界面配对。必须使用各个App本身提供的功能进行连接。针对XCMania，进入App在《设置》=>《高度表设置》然后使用以下按钮：

通过XCMania中的“设置”修改Alps参数

Alps可以无缝共享XCMania的高度表声音设置，您只需要在XCMania中通过蓝牙连接Alps，并点击下方的“向Alps同步设置”按钮即可。蓝色区域的所有设置都会被推送到Alps。

● 可在XCMania中设置
○ 上升响起数值，默认0.2米/每秒。
○ 上升停响数值，默认0.15米/每秒。
○ 下沉响起数值，默认2米/每秒。
○ 音调风格：单音/滑动音，默认滑动音。
○ Near Lift（气流边缘侦测）
■ 进入飞行状态后，从 -0.5米/秒 开始响起哒哒声，包括你降落后在地面 0米/秒 。
○ 蓝牙通讯格式：可以在数个协议之间切换，LXNAV仅适用于远古XCSoar等滑翔机应用，传递信息较少。
● 自动关机
○ 当十分钟没有高度变化时，高度表会自动关机。
○ 当电量过低时，会自动关机保护电池。
● 充电
○ USB-C 1小时高速充电。
○ 太阳能充电。

## 气流边缘嗅探

首次接触此类功能的飞行员经常误会为仪器故障。所以请认真看完此章节。

起飞后，仪器会在接近气流边缘时（-0.5米/秒开始至上升停响数值）响起短促的“哒哒”声音，包括弱上升与弱下沉区，包括0米/秒的区域。（在降落后静止不动地面的0米/秒也会响。）

探索弱气流区需要非常精密而灵敏的设备。

嗅探状态
● 起飞前状态：起飞前保持安静状态。在0米附近范围内不会发声。
● 飞行中状态：将在气流边缘全范围发声。

回到起飞前状态
如果在起飞前有气流风可能导致仪器提前进入飞行状态，站在原地会有“哒哒”声音响起。此时只需要短按电源键，即可回到起飞前静默状态。

## 注意事项

**请在使用时遵守以下注意事项。**

* **安装位置不可靠近对讲机等大功率发射设备。**
* **需要将仪器固定在座袋上阳光可以照射的位置。**
* **遮挡太阳能版会导致续航时间变短。**
* **仪器不防水，仪器进水会导致损坏。**
* **不要遗留在夏日暴晒的车内或温度高于50摄氏度的区域。**
* **太阳能充电需要通风环境。**

# 常见问题

* **请使用5v充电器或带有国际QC标准的USB充电设备。避免使用土产手机厂商的特高压高速充器材，特高压充电设备可能无法充电或造成永久损坏。**
* **部分充电器电磁干扰严重可能导致充电时无法开机或出现其他异常，拔掉充电器即可正常操作。**
* **在无阳光的情况下使用时，续航会下降。**
* **在玻璃/汽车挡风玻璃之后太阳能充电效率非常低，只有约30%。**
* **大风的日子里，即便在屋内静止时也会有气压变化，仪器会响应。**
* **无法开机的状况**

  * **可先接入USB开始充电，然后尝试开机。**
* **在冬季低温情况下使用时，电池可用容量会降低。**
* **使用时间与音量与日照情况相关，最大音量连续使用约10～20小时。如每次飞行时间较短，飞行前后有日照充电则可以使用20～100小时。**
* **当旅行到温差较大地区时，可进行一次校准。**