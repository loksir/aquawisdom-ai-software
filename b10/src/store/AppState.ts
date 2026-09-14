import { combineReducers } from "redux";
import { UserProfileReducer} from "./user/Reducer";
import { ThreadCategoriesReducer } from "./categories/Reducer";
import { UiReducer } from "./ui/Reducer"; // <-- ADD THIS IMPORT

export const rootReducer = combineReducers({
    user: UserProfileReducer,
    categories: ThreadCategoriesReducer,
    ui: UiReducer, // <-- ADD THIS LINE
});

export type AppState = ReturnType<typeof rootReducer>;