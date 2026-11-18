/** 表单的「玩家正忙」重试；等待方式由平台注入，便于测试真实的取消时序。 */
export async function retryForm<R extends { canceled: boolean, cancelationReason?: string }>(
    show: () => Promise<R>, wait: () => Promise<void>, retries = 30, onBusy?: () => void, isActive?: () => boolean,
): Promise<R> {
    for (let left = retries; ; left--) {
        const result = await show()
        if (!result.canceled || result.cancelationReason !== 'UserBusy' || left <= 0 || isActive?.() === false) return result
        onBusy?.()
        await wait()
        // 等待期间界面可能关闭或被更新的请求替换；旧请求不能再打开表单。
        if (isActive?.() === false) return result
    }
}
