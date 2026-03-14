import type {operations} from "../api-types/adminApiTypes";
import {createAPIClient} from "@/app/api-client";

const shopwellEndpoint = "http://127.0.0.1:8083/store-api";

export const apiClient = createAPIClient<operations>({
    baseURL: shopwellEndpoint,
    accessToken: "SWSCCE9HBLFGALDJUWHBMLNKTG",
});
