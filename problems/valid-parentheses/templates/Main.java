import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String s = reader.readLine();
        Deque<Character> stack = new ArrayDeque<>();
        for (char ch : s.toCharArray()) {
            if (ch == '(' || ch == '[' || ch == '{') {
                stack.push(ch);
            } else {
                if (stack.isEmpty()) {
                    System.out.println("false");
                    return;
                }
                char left = stack.pop();
                if ((ch == ')' && left != '(') || (ch == ']' && left != '[') || (ch == '}' && left != '{')) {
                    System.out.println("false");
                    return;
                }
            }
        }
        System.out.println(stack.isEmpty() ? "true" : "false");
    }
}
