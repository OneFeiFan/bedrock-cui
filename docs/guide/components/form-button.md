# 按钮

界面文件使用 `button().onClick(方法)` 创建按钮，外观由 `default`、`hover`、`pressed` 三个状态面板组成，见[逻辑中的按钮与方法](../logic.md#按钮与方法)。

点击后，bedrock-cui 执行绑定的方法，并以新的数据重新打开界面。关闭按钮使用内置的 `close` 方法。
