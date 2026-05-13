import sys


def main():
    s = sys.stdin.read().strip()
    stack = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif not stack or stack.pop() != pairs[ch]:
            print("false")
            return
    print("true" if not stack else "false")


if __name__ == "__main__":
    main()
