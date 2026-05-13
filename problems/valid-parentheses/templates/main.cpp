#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string s;
    cin >> s;
    vector<char> stack;
    for (char ch : s) {
        if (ch == '(' || ch == '[' || ch == '{') {
            stack.push_back(ch);
        } else {
            if (stack.empty()) {
                cout << "false\n";
                return 0;
            }
            char left = stack.back();
            stack.pop_back();
            if ((ch == ')' && left != '(') || (ch == ']' && left != '[') || (ch == '}' && left != '{')) {
                cout << "false\n";
                return 0;
            }
        }
    }
    cout << (stack.empty() ? "true" : "false") << '\n';
    return 0;
}
