<template>
    <view class="content">
        <image class="logo" src="/static/logo.png"/>
        <view class="text-area">
            <text class="title">{{ title }}</text>
        </view>
    </view>
</template>

<script setup lang="ts">
import {ref} from "vue";
import {onLoad} from "@dcloudio/uni-app";
import {useShopwellContext} from "@/app/composables/useShopwellContext/useShopwareContext";

const title = ref("0000");

const {apiClient} = useShopwellContext();

const loadCart = async () => {
    try {
        const result = await apiClient.invoke("readCart get /checkout/cart");
        console.log(result.status, result.data);
    } catch (error) {
        console.error("[cart] request failed", error);
    }
};

onLoad(() => {
    void loadCart();
});
</script>

<style>
.content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.logo {
    height: 200rpx;
    width: 200rpx;
    margin-top: 200rpx;
    margin-left: auto;
    margin-right: auto;
    margin-bottom: 50rpx;
}

.text-area {
    display: flex;
    justify-content: center;
}

.title {
    font-size: 36rpx;
    color: #8f8f94;
}
</style>

